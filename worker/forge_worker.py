"""Authenticated, idempotent media worker for EditForge.

Runs on a GPU host. The Next.js studio remains the control plane; this process
owns uploaded source assets, model execution, FFmpeg mastering, and artifacts.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
import hashlib
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import shutil
import threading
import time
from typing import Any, Callable
from urllib.parse import unquote, urlparse

from adapters import (
    blank_video,
    EngineFailure,
    EngineUnavailable,
    chatterbox_voice,
    concat_master,
    engine_status,
    liveportrait_animate,
    ltx_generate,
    master_video,
    musetalk_lipsync,
    sha256,
    verify_master,
)


JOB_KINDS = {
    "voice",
    "avatar",
    "gen-video",
    "proof-shot",
    "episode-generate",
    "episode-master",
    "thread-master",
}
ASSET_KINDS = {
    "identity-image",
    "voice-reference",
    "consent-record",
    "driving-video",
    "visual-reference",
    "audio",
    "video",
    "caption-track",
    "master",
}
SAFE_ID = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")


def _atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, sort_keys=True), encoding="utf-8")
    temp.replace(path)


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _safe_filename(value: str) -> str:
    name = Path(value).name
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", name).strip(".-")
    return cleaned[:128] or "asset.bin"


@dataclass(frozen=True)
class WorkerPaths:
    root: Path

    @property
    def assets(self) -> Path:
        return self.root / "assets"

    @property
    def asset_meta(self) -> Path:
        return self.root / "asset-meta"

    @property
    def tickets(self) -> Path:
        return self.root / "upload-tickets"

    @property
    def jobs(self) -> Path:
        return self.root / "jobs"

    @property
    def job_work(self) -> Path:
        return self.root / "job-work"

    @property
    def artifacts(self) -> Path:
        return self.root / "artifacts"

    @property
    def artifact_meta(self) -> Path:
        return self.root / "artifact-meta"

    def initialize(self) -> None:
        for path in (
            self.assets,
            self.asset_meta,
            self.tickets,
            self.jobs,
            self.job_work,
            self.artifacts,
            self.artifact_meta,
        ):
            path.mkdir(parents=True, exist_ok=True)


class WorkerRuntime:
    def __init__(
        self,
        root: Path,
        *,
        max_workers: int = 1,
        execute_override: Callable[[dict[str, Any], Path], Path] | None = None,
    ) -> None:
        self.paths = WorkerPaths(root.resolve())
        self.paths.initialize()
        self.pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="forge-job")
        self.lock = threading.RLock()
        self.execute_override = execute_override

    def health(self) -> dict[str, Any]:
        engines = engine_status()
        return {
            "ok": True,
            "service": "editforge-worker",
            "version": "1.0.0",
            "engines": engines,
            "readyFor": {
                "voice": engines["chatterbox"]["ready"],
                "avatar": engines["liveportrait"]["ready"],
                "lipSync": engines["musetalk"]["ready"],
                "genVideo": engines["ltx"]["ready"],
                "mastering": engines["ffmpeg"]["ready"],
                "proofShot": all(
                    engines[name]["ready"]
                    for name in ("chatterbox", "liveportrait", "musetalk", "ffmpeg")
                ),
                "episodeGenerate": all(
                    engines[name]["ready"]
                    for name in ("chatterbox", "liveportrait", "musetalk", "ltx", "ffmpeg")
                ),
            },
        }

    def create_upload_ticket(self, request: dict[str, Any]) -> dict[str, Any]:
        filename = _safe_filename(str(request.get("filename", "asset.bin")))
        kind = str(request.get("kind", ""))
        if kind not in ASSET_KINDS:
            raise ValueError(f"Unknown asset kind: {kind}")
        max_allowed = int(os.environ.get("EDITFORGE_MAX_UPLOAD_BYTES", str(2 * 1024 * 1024 * 1024)))
        requested_max = int(request.get("maxBytes", max_allowed))
        max_bytes = min(max_allowed, max(1, requested_max))
        expected = str(request.get("sha256", "")).lower()
        if expected and not re.fullmatch(r"[a-f0-9]{64}", expected):
            raise ValueError("sha256 must be a complete hexadecimal SHA-256 digest")

        token = secrets.token_urlsafe(32)
        ticket = {
            "id": token,
            "filename": filename,
            "kind": kind,
            "mimeType": str(request.get("mimeType", "application/octet-stream")),
            "maxBytes": max_bytes,
            "sha256": expected or None,
            "consentId": request.get("consentId"),
            "expiresAt": time.time() + min(3600, int(request.get("expiresInSec", 900))),
            "used": False,
        }
        _atomic_json(self.paths.tickets / f"{token}.json", ticket)
        return {"ticket": token, "uploadPath": f"/v1/uploads/{token}", "expiresAt": ticket["expiresAt"]}

    def consume_upload(self, token: str, reader: Any, content_length: int) -> dict[str, Any]:
        ticket_path = self.paths.tickets / f"{token}.json"
        with self.lock:
            if not ticket_path.is_file():
                raise FileNotFoundError("Unknown upload ticket")
            ticket = _read_json(ticket_path)
            if ticket.get("used"):
                raise ValueError("Upload ticket has already been used")
            if float(ticket.get("expiresAt", 0)) < time.time():
                raise ValueError("Upload ticket has expired")
            if content_length < 0 or content_length > int(ticket["maxBytes"]):
                raise ValueError("Upload exceeds the ticket size limit")

            temp = self.paths.assets / f"upload-{token}.tmp"
            digest = hashlib.sha256()
            remaining = content_length
            written = 0
            with temp.open("wb") as target:
                while remaining > 0:
                    chunk = reader.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ValueError("Upload ended before Content-Length bytes arrived")
                    target.write(chunk)
                    digest.update(chunk)
                    written += len(chunk)
                    remaining -= len(chunk)

            actual = digest.hexdigest()
            if ticket.get("sha256") and ticket["sha256"] != actual:
                temp.unlink(missing_ok=True)
                raise ValueError("Uploaded bytes do not match the declared SHA-256")
            asset_id = f"asset-{actual[:24]}"
            suffix = Path(ticket["filename"]).suffix.lower()[:12]
            destination = self.paths.assets / f"{asset_id}{suffix}"
            if destination.exists():
                temp.unlink(missing_ok=True)
            else:
                temp.replace(destination)
            metadata = {
                "id": asset_id,
                "kind": ticket["kind"],
                "label": ticket["filename"],
                "filename": destination.name,
                "mimeType": ticket["mimeType"],
                "bytes": written,
                "sha256": actual,
                "consentId": ticket.get("consentId"),
                "createdAt": time.time(),
            }
            _atomic_json(self.paths.asset_meta / f"{asset_id}.json", metadata)
            ticket["used"] = True
            _atomic_json(ticket_path, ticket)
            return metadata

    def asset(self, asset_id: str) -> tuple[dict[str, Any], Path]:
        if not SAFE_ID.fullmatch(asset_id):
            raise FileNotFoundError("Invalid asset id")
        metadata_path = self.paths.asset_meta / f"{asset_id}.json"
        if not metadata_path.is_file():
            raise FileNotFoundError(f"Unknown asset: {asset_id}")
        metadata = _read_json(metadata_path)
        path = (self.paths.assets / metadata["filename"]).resolve()
        if self.paths.assets not in path.parents or not path.is_file():
            raise FileNotFoundError(f"Asset file missing: {asset_id}")
        return metadata, path

    def register_artifact(self, source: Path, *, kind: str, job_id: str) -> dict[str, Any]:
        digest = sha256(source)
        artifact_id = f"artifact-{digest[:24]}"
        suffix = source.suffix.lower() or ".bin"
        destination = self.paths.artifacts / f"{artifact_id}{suffix}"
        if source.resolve() != destination.resolve() and not destination.exists():
            shutil.copy2(source, destination)
        metadata = {
            "id": artifact_id,
            "kind": kind,
            "jobId": job_id,
            "filename": destination.name,
            "mimeType": mimetypes.guess_type(destination.name)[0] or "application/octet-stream",
            "bytes": destination.stat().st_size,
            "sha256": digest,
            "createdAt": time.time(),
        }
        _atomic_json(self.paths.artifact_meta / f"{artifact_id}.json", metadata)
        return metadata

    def artifact(self, artifact_id: str) -> tuple[dict[str, Any], Path]:
        if not SAFE_ID.fullmatch(artifact_id):
            raise FileNotFoundError("Invalid artifact id")
        meta_path = self.paths.artifact_meta / f"{artifact_id}.json"
        if not meta_path.is_file():
            raise FileNotFoundError(f"Unknown artifact: {artifact_id}")
        metadata = _read_json(meta_path)
        path = (self.paths.artifacts / metadata["filename"]).resolve()
        if self.paths.artifacts not in path.parents or not path.is_file():
            raise FileNotFoundError(f"Artifact file missing: {artifact_id}")
        return metadata, path

    def media(self, media_id: str) -> tuple[dict[str, Any], Path]:
        """Resolve an uploaded source asset or a prior worker artifact.

        Episode assembly consumes both: editorial uploads arrive as assets, while
        generated shots and accepted episode masters arrive as artifacts.
        """
        try:
            return self.asset(media_id)
        except FileNotFoundError as asset_error:
            try:
                return self.artifact(media_id)
            except FileNotFoundError:
                raise FileNotFoundError(f"Unknown media: {media_id}") from asset_error

    def create_job(self, request: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        kind = str(request.get("kind", ""))
        if kind not in JOB_KINDS:
            raise ValueError(f"Unknown job kind: {kind}")
        key = str(request.get("idempotencyKey", "")).strip()
        if not key:
            raise ValueError("idempotencyKey is required")
        digest = hashlib.sha256(f"{kind}:{key}".encode()).hexdigest()
        job_id = f"forge-{digest[:24]}"
        path = self.paths.jobs / f"{job_id}.json"
        with self.lock:
            if path.is_file():
                return _read_json(path), True
            now = time.time()
            job = {
                "id": job_id,
                "kind": kind,
                "status": "queued",
                "prompt": str(request.get("prompt", "")),
                "idempotencyKey": key,
                "options": request.get("options") if isinstance(request.get("options"), dict) else {},
                "createdAt": now,
                "updatedAt": now,
            }
            _atomic_json(path, job)
            self.pool.submit(self.run_job, job_id)
            return job, False

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        if not SAFE_ID.fullmatch(job_id):
            return None
        path = self.paths.jobs / f"{job_id}.json"
        return _read_json(path) if path.is_file() else None

    def _update_job(self, job_id: str, **patch: Any) -> dict[str, Any]:
        with self.lock:
            path = self.paths.jobs / f"{job_id}.json"
            job = _read_json(path)
            job.update(patch)
            job["updatedAt"] = time.time()
            _atomic_json(path, job)
            return job

    def run_job(self, job_id: str) -> None:
        job = self.get_job(job_id)
        if not job or job["status"] != "queued":
            return
        self._update_job(job_id, status="running", note="Worker execution started")
        work_dir = self.paths.job_work / job_id
        work_dir.mkdir(parents=True, exist_ok=True)
        try:
            output = self.execute_override(job, work_dir) if self.execute_override else self._execute(job, work_dir)
            artifact = self.register_artifact(output, kind=job["kind"], job_id=job_id)
            self._update_job(
                job_id,
                status="succeeded",
                result=f"/v1/artifacts/{artifact['id']}",
                artifact=artifact,
                note="Real media produced; awaiting EditForge validation",
            )
        except (EngineUnavailable, EngineFailure, FileNotFoundError, ValueError) as error:
            self._update_job(job_id, status="failed", error=str(error), note="Worker execution failed honestly")
        except Exception as error:  # pragma: no cover - last-resort record, never fabricated success
            self._update_job(job_id, status="failed", error=f"Unexpected worker failure: {error}")

    def _consented_asset(self, asset_id: str, consent_id: str) -> Path:
        metadata, path = self.asset(asset_id)
        if metadata.get("consentId") != consent_id:
            raise ValueError(f"Asset {asset_id} is not linked to consent record {consent_id}")
        return path

    def _execute(self, job: dict[str, Any], work_dir: Path) -> Path:
        kind = job["kind"]
        options = job.get("options", {})
        prompt = str(job.get("prompt", ""))

        if kind == "voice":
            consent_id = str(options.get("consentId", ""))
            self.asset(consent_id)
            reference = self._consented_asset(str(options.get("voiceReferenceAssetId", "")), consent_id)
            return chatterbox_voice(prompt, reference, work_dir / "voice.wav", work_dir)

        if kind == "avatar":
            consent_id = str(options.get("consentId", ""))
            self.asset(consent_id)
            source = self._consented_asset(str(options.get("sourceImageAssetId", "")), consent_id)
            driving = self._consented_asset(str(options.get("drivingVideoAssetId", "")), consent_id)
            animated = liveportrait_animate(source, driving, work_dir / "liveportrait")
            audio_id = options.get("audioAssetId")
            if audio_id:
                _, audio = self.media(str(audio_id))
                return musetalk_lipsync(animated, audio, work_dir / "musetalk", work_dir)
            return animated

        if kind == "gen-video":
            refs = [self.asset(str(asset_id))[1] for asset_id in options.get("referenceAssetIds", [])]
            return ltx_generate(
                prompt,
                refs,
                work_dir / "generated.mp4",
                seconds=int(options.get("durationSec", 5)),
                seed=int(options.get("seed", 17)),
            )

        if kind == "proof-shot":
            consent_id = str(options.get("consentId", ""))
            consent_meta, _ = self.asset(consent_id)
            if consent_meta.get("kind") != "consent-record":
                raise ValueError("Proof shot consentId must identify a consent-record asset")
            identity = self._consented_asset(str(options.get("identityAssetId", "")), consent_id)
            voice_ref = self._consented_asset(str(options.get("voiceReferenceAssetId", "")), consent_id)
            driving = self._consented_asset(str(options.get("drivingVideoAssetId", "")), consent_id)
            voice = chatterbox_voice(prompt, voice_ref, work_dir / "proof-voice.wav", work_dir)
            motion = liveportrait_animate(identity, driving, work_dir / "liveportrait")
            synced = musetalk_lipsync(motion, voice, work_dir / "musetalk", work_dir)
            return master_video(synced, work_dir / "identity-proof-4k.mp4")

        if kind == "episode-generate":
            target_duration = float(options.get("durationSec", 90.0))
            if not 1.0 <= target_duration <= 180.0:
                raise ValueError("episode-generate durationSec must be between 1 and 180 seconds")
            beats = options.get("beats")
            if not isinstance(beats, list) or not beats:
                raise ValueError("episode-generate requires a non-empty beat plan")
            characters = {
                str(item.get("id")): item
                for item in options.get("characters", [])
                if isinstance(item, dict) and item.get("id")
            }
            speaker_ids = {
                "DEVON": "devon-rook",
                "DEVON ROOK": "devon-rook",
                "TAVI": "tavi",
                "ORIN": "orin",
                "SANA": "sana",
                "JONAH": "jonah",
                "THE SECOND": "the-second",
                "MASKED FOUNDER": "the-second",
                "FOUNDER": "the-second",
                "AUREN": "auren",
                "VESPERA": "vespera",
            }
            reference_paths = [
                self.media(str(asset_id))[1]
                for asset_id in options.get("referenceAssetIds", [])
            ]
            segments: list[Path] = []
            cursor = 0.0
            ordered = sorted(beats, key=lambda item: float(item.get("startSec", 0)))
            for index, beat in enumerate(ordered):
                if not isinstance(beat, dict):
                    raise ValueError("Every episode beat must be an object")
                start = float(beat.get("startSec", 0))
                end = float(beat.get("endSec", 0))
                if start < cursor - 0.001 or end <= start or end > target_duration:
                    raise ValueError(f"Invalid or overlapping beat range at index {index}")
                if start > cursor + 0.001:
                    segments.append(blank_video(work_dir / f"gap-{index:03d}.mp4", duration=start - cursor))
                duration = end - start
                speaker = str(beat.get("speaker", "")).strip().upper()
                text = str(beat.get("text", "")).strip()
                if speaker:
                    character_id = speaker_ids.get(speaker)
                    character = characters.get(character_id or "")
                    if not character:
                        raise ValueError(f"No character pack mapped for speaker {speaker}")
                    consent_id = str(character.get("consentAssetId", ""))
                    consent_meta, _ = self.asset(consent_id)
                    if consent_meta.get("kind") != "consent-record":
                        raise ValueError(f"{speaker} consentAssetId must identify a consent-record asset")
                    identity = self._consented_asset(str(character.get("identityAssetId", "")), consent_id)
                    voice_ref = self._consented_asset(str(character.get("voiceReferenceAssetId", "")), consent_id)
                    driving = self._consented_asset(str(character.get("drivingVideoAssetId", "")), consent_id)
                    voice = chatterbox_voice(text, voice_ref, work_dir / f"voice-{index:03d}.wav", work_dir)
                    motion = liveportrait_animate(identity, driving, work_dir / f"liveportrait-{index:03d}")
                    synced = musetalk_lipsync(motion, voice, work_dir / f"musetalk-{index:03d}", work_dir)
                    segment = master_video(
                        synced,
                        work_dir / f"beat-{index:03d}.mp4",
                        target_duration=duration,
                    )
                else:
                    project_title = str(options.get("projectTitle", "EditForge production")).strip()
                    production_notes = options.get("productionNotes", [])
                    notes = "; ".join(str(note) for note in production_notes if str(note).strip())
                    cinematic = ltx_generate(
                        f"{project_title} cinematic shot. {text}. {notes} Vertical 9:16; preserve approved character and visual continuity; no unrequested titles.",
                        reference_paths,
                        work_dir / f"generated-{index:03d}.mp4",
                        seconds=max(1, int(duration + 0.999)),
                        seed=17 + index,
                    )
                    segment = master_video(
                        cinematic,
                        work_dir / f"beat-{index:03d}.mp4",
                        target_duration=duration,
                    )
                segments.append(segment)
                cursor = end
            if cursor < target_duration:
                segments.append(blank_video(work_dir / "ending-hold.mp4", duration=target_duration - cursor))
            return concat_master(
                segments,
                work_dir / "episode-generated-4k.mp4",
                expected_count=len(segments),
                target_duration=target_duration,
            )

        if kind == "episode-master":
            target_duration = float(options.get("durationSec", 90.0))
            if not 1.0 <= target_duration <= 180.0:
                raise ValueError("episode-master durationSec must be between 1 and 180 seconds")
            assets = [self.media(str(asset_id))[1] for asset_id in options.get("segmentAssetIds", [])]
            if not assets:
                raise ValueError("episode-master requires segmentAssetIds")
            normalized: list[Path] = []
            for index, asset in enumerate(assets):
                normalized.append(master_video(asset, work_dir / f"segment-{index:03d}.mp4"))
            assembled = concat_master(
                normalized,
                work_dir / "episode-assembled.mp4",
                expected_count=len(normalized),
                target_duration=None,
            )
            return master_video(assembled, work_dir / "episode-master-4k.mp4", target_duration=target_duration)

        if kind == "thread-master":
            expected_count = int(options.get("expectedCount", 12))
            episode_duration = float(options.get("episodeDurationSec", 90.0))
            total_duration = float(options.get("totalDurationSec", expected_count * episode_duration))
            if expected_count < 1 or expected_count > 108:
                raise ValueError("thread-master expectedCount must be between 1 and 108")
            assets = [self.media(str(asset_id))[1] for asset_id in options.get("episodeAssetIds", [])]
            for asset in assets:
                verify_master(asset, target_duration=episode_duration)
            return concat_master(
                assets,
                work_dir / "collection-master-4k.mp4",
                expected_count=expected_count,
                target_duration=total_duration,
            )

        raise ValueError(f"Unsupported job kind: {kind}")


class Handler(BaseHTTPRequestHandler):
    runtime: WorkerRuntime
    token: str
    cors_origin: str

    server_version = "EditForgeWorker/1.0"

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}")

    def _cors(self) -> None:
        if self.cors_origin:
            self.send_header("Access-Control-Allow-Origin", self.cors_origin)
            self.send_header("Vary", "Origin")

    def _json(self, status: int, body: dict[str, Any]) -> None:
        payload = json.dumps(body).encode()
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _authorized(self) -> bool:
        provided = self.headers.get("Authorization", "")
        expected = f"Bearer {self.token}"
        return bool(self.token) and secrets.compare_digest(provided, expected)

    def _require_auth(self) -> bool:
        if self._authorized():
            return True
        self._json(HTTPStatus.UNAUTHORIZED, {"error": "Worker authentication required"})
        return False

    def _body_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 2 * 1024 * 1024:
            raise ValueError("JSON body must be between 1 byte and 2 MiB")
        value = json.loads(self.rfile.read(length))
        if not isinstance(value, dict):
            raise ValueError("JSON body must be an object")
        return value

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Authorization, Content-Type, Content-Length, Idempotency-Key",
        )
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health":
            self._json(HTTPStatus.OK, self.runtime.health())
            return
        if not self._require_auth():
            return
        if path == "/v1/capabilities":
            self._json(HTTPStatus.OK, self.runtime.health())
            return
        if path.startswith("/v1/jobs/"):
            job = self.runtime.get_job(unquote(path.removeprefix("/v1/jobs/")))
            self._json(HTTPStatus.OK if job else HTTPStatus.NOT_FOUND, job or {"error": "Job not found"})
            return
        if path.startswith("/v1/artifacts/"):
            try:
                metadata, artifact = self.runtime.artifact(unquote(path.removeprefix("/v1/artifacts/")))
                self._send_file(artifact, metadata["mimeType"])
            except FileNotFoundError as error:
                self._json(HTTPStatus.NOT_FOUND, {"error": str(error)})
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if not self._require_auth():
            return
        try:
            if path == "/v1/jobs":
                job, deduped = self.runtime.create_job(self._body_json())
                self._json(HTTPStatus.OK if deduped else HTTPStatus.CREATED, {**job, "deduped": deduped})
                return
            if path == "/v1/upload-tickets":
                ticket = self.runtime.create_upload_ticket(self._body_json())
                self._json(HTTPStatus.CREATED, ticket)
                return
            self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
        except (ValueError, FileNotFoundError) as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def do_PUT(self) -> None:
        path = urlparse(self.path).path
        if not path.startswith("/v1/uploads/"):
            self._json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        try:
            token = unquote(path.removeprefix("/v1/uploads/"))
            length = int(self.headers.get("Content-Length", "-1"))
            asset = self.runtime.consume_upload(token, self.rfile, length)
            self._json(HTTPStatus.CREATED, {"asset": asset})
        except (ValueError, FileNotFoundError) as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def _send_file(self, path: Path, mime_type: str) -> None:
        size = path.stat().st_size
        start, end = 0, size - 1
        range_header = self.headers.get("Range")
        status = HTTPStatus.OK
        if range_header and range_header.startswith("bytes="):
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header)
            if not match:
                self._json(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE, {"error": "Invalid byte range"})
                return
            if match.group(1):
                start = int(match.group(1))
            if match.group(2):
                end = min(size - 1, int(match.group(2)))
            if start > end or start >= size:
                self._json(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE, {"error": "Byte range outside artifact"})
                return
            status = HTTPStatus.PARTIAL_CONTENT

        length = end - start + 1
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        if status == HTTPStatus.PARTIAL_CONTENT:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with path.open("rb") as source:
            source.seek(start)
            remaining = length
            while remaining > 0:
                chunk = source.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)


def serve() -> None:
    token = os.environ.get("EDITFORGE_WORKER_TOKEN", "")
    if len(token) < 24:
        raise SystemExit("EDITFORGE_WORKER_TOKEN must be set to at least 24 characters")
    root = Path(os.environ.get("EDITFORGE_WORKER_DATA", "./worker-data"))
    runtime = WorkerRuntime(root, max_workers=max(1, int(os.environ.get("EDITFORGE_WORKER_CONCURRENCY", "1"))))
    Handler.runtime = runtime
    Handler.token = token
    Handler.cors_origin = os.environ.get("EDITFORGE_APP_ORIGIN", "")
    host = os.environ.get("EDITFORGE_WORKER_HOST", "127.0.0.1")
    port = int(os.environ.get("EDITFORGE_WORKER_PORT", "8787"))
    print(json.dumps({"event": "worker-start", "host": host, "port": port, "health": runtime.health()}))
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    serve()
