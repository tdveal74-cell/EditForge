#!/usr/bin/env python3
"""Private Kokoro HTTP adapter for EditForge.

The service binds only to the EditForge render bridge gateway. It returns WAV
bytes directly, matching the existing binary-provider contract.
"""

from __future__ import annotations

import hmac
import io
import json
import os
import pathlib
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import soundfile as sf
from kokoro_onnx import Kokoro


HOST = os.environ.get("EDITFORGE_LOCAL_TOOLS_HOST", "172.16.2.1")
PORT = int(os.environ.get("EDITFORGE_LOCAL_TOOLS_PORT", "3410"))
TOKEN = os.environ.get("EDITFORGE_PROVIDER_TOKEN", "").strip()
MODEL = os.environ.get("KOKORO_MODEL_PATH", "/opt/editforge-local-tools/models/kokoro-v1.0.onnx")
VOICES = os.environ.get("KOKORO_VOICES_PATH", "/opt/editforge-local-tools/models/voices-v1.0.bin")
MAX_TEXT = int(os.environ.get("KOKORO_MAX_CHARACTERS", "5000"))
HYPERFRAMES_ROOT = pathlib.Path(os.environ.get("HYPERFRAMES_PROJECT_ROOT", "/opt/hyperframes-projects"))
HYPERFRAMES_BIN = os.environ.get("HYPERFRAMES_BIN", "hyperframes")
HYPERFRAMES_TIMEOUT = int(os.environ.get("HYPERFRAMES_TIMEOUT_SECONDS", "600"))

_engine: Kokoro | None = None
_engine_lock = threading.Lock()
_generation_lock = threading.Lock()
_render_lock = threading.Lock()


def safe_project(slug: str) -> pathlib.Path:
    if not slug or len(slug) > 80 or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-" for ch in slug):
        raise ValueError("invalid HyperFrames project slug")
    project = (HYPERFRAMES_ROOT / slug).resolve()
    root = HYPERFRAMES_ROOT.resolve()
    if project.parent != root or not project.is_dir() or not (project / "hyperframes.json").is_file():
        raise ValueError("HyperFrames project not found")
    return project


def render_hyperframes(project: pathlib.Path) -> bytes:
    renders = project / "renders"
    renders.mkdir(exist_ok=True)
    started = time.time()
    env = dict(os.environ)
    env.update({"CI": "1", "NO_COLOR": "1"})
    log_path = project / ".editforge-hyperframes-render.log"
    log = log_path.open("w", encoding="utf-8")
    process = subprocess.Popen(
        [HYPERFRAMES_BIN, "render"],
        cwd=project,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        text=True,
    )
    deadline = started + HYPERFRAMES_TIMEOUT
    candidate: pathlib.Path | None = None
    stable_size = -1
    stable_since = time.time()
    try:
        while time.time() < deadline:
            files = [path for path in renders.glob("*.mp4") if path.stat().st_mtime >= started - 1]
            if files:
                newest = max(files, key=lambda path: path.stat().st_mtime)
                size = newest.stat().st_size
                if newest == candidate and size > 0 and size == stable_size:
                    if time.time() - stable_since >= 2:
                        return newest.read_bytes()
                else:
                    candidate = newest
                    stable_size = size
                    stable_since = time.time()
            if process.poll() is not None and not files:
                log.flush()
                output = log_path.read_text(encoding="utf-8", errors="replace")[-2000:]
                raise RuntimeError(f"HyperFrames exited {process.returncode}: {output}")
            time.sleep(1)
        raise TimeoutError(f"HyperFrames exceeded {HYPERFRAMES_TIMEOUT} seconds")
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        log.close()


def engine() -> Kokoro:
    global _engine
    with _engine_lock:
        if _engine is None:
            _engine = Kokoro(MODEL, VOICES)
        return _engine


class Handler(BaseHTTPRequestHandler):
    server_version = "EditForgeLocalTools/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} {fmt % args}", flush=True)

    def json_response(self, status: int, value: dict[str, object]) -> None:
        body = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def authorized(self) -> bool:
        supplied = self.headers.get("Authorization", "")
        if supplied.lower().startswith("bearer "):
            supplied = supplied[7:].strip()
        return bool(TOKEN) and hmac.compare_digest(supplied, TOKEN)

    def do_GET(self) -> None:
        if self.path != "/health":
            return self.json_response(404, {"error": "not found"})
        ready = bool(TOKEN) and os.path.isfile(MODEL) and os.path.isfile(VOICES)
        self.json_response(
            200 if ready else 503,
            {
                "status": "ready" if ready else "configuration_required",
                "kokoroModel": os.path.isfile(MODEL),
                "kokoroVoices": os.path.isfile(VOICES),
                "authenticated": bool(TOKEN),
            },
        )

    def do_POST(self) -> None:
        if self.path not in {"/v1/kokoro", "/v1/hyperframes"}:
            return self.json_response(404, {"error": "not found"})
        if not self.authorized():
            return self.json_response(401, {"error": "unauthorized"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 1_000_000:
                raise ValueError("invalid request size")
            request = json.loads(self.rfile.read(size))
            if self.path == "/v1/hyperframes":
                project = safe_project(str(request.get("project", "")).strip())
                if not _render_lock.acquire(blocking=False):
                    return self.json_response(409, {"error": "a HyperFrames render is already running"})
                try:
                    body = render_hyperframes(project)
                finally:
                    _render_lock.release()
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
                return

            text = str(request.get("text", "")).strip()
            voice = str(request.get("voice", "af_sarah")).strip()
            lang = str(request.get("lang", "en-us")).strip()
            speed = float(request.get("speed", 1.0))
            if not text:
                raise ValueError("text is required")
            if len(text) > MAX_TEXT:
                raise ValueError(f"text exceeds {MAX_TEXT} characters")
            if not voice or len(voice) > 80:
                raise ValueError("invalid voice")
            if lang not in {"en-us", "en-gb", "es", "fr-fr", "it", "pt-br", "ja", "zh"}:
                raise ValueError("unsupported language")
            if speed < 0.5 or speed > 2:
                raise ValueError("speed must be from 0.5 to 2")

            with _generation_lock:
                samples, sample_rate = engine().create(text, voice=voice, speed=speed, lang=lang)
            output = io.BytesIO()
            sf.write(output, samples, sample_rate, format="WAV", subtype="PCM_16")
            body = output.getvalue()
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self.json_response(400, {"error": str(error)})
        except Exception as error:
            self.json_response(500, {"error": f"Kokoro generation failed: {error}"})


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("EDITFORGE_PROVIDER_TOKEN is required")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
