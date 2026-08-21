"""Pinned execution adapters for the self-hosted EditForge media worker.

The worker owns orchestration and provenance. Model repositories remain separate
and are discovered through explicit *_HOME variables so upstream code, weights,
and licenses are never silently vendored into EditForge.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any, Iterable


class EngineUnavailable(RuntimeError):
    pass


class EngineFailure(RuntimeError):
    pass


def _accepted(name: str) -> bool:
    return os.environ.get(f"EDITFORGE_ACCEPT_{name.upper()}_LICENSE", "").lower() == "true"


def _home(name: str) -> Path | None:
    value = os.environ.get(f"EDITFORGE_{name.upper()}_HOME")
    return Path(value).expanduser().resolve() if value else None


def _python() -> str:
    return os.environ.get("EDITFORGE_ENGINE_PYTHON", sys.executable)


def _run(args: list[str], *, cwd: Path | None = None, timeout: int = 7200) -> None:
    try:
        completed = subprocess.run(
            args,
            cwd=str(cwd) if cwd else None,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )
    except subprocess.TimeoutExpired as error:
        raise EngineFailure(f"Engine timed out after {timeout}s: {args[0]}") from error
    except OSError as error:
        raise EngineFailure(f"Could not start {args[0]}: {error}") from error

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()[-4000:]
        raise EngineFailure(
            f"Engine exited {completed.returncode}: {' '.join(args[:4])}"
            + (f"\n{detail}" if detail else "")
        )


def _newest(root: Path, suffix: str) -> Path:
    matches = [path for path in root.rglob(f"*{suffix}") if path.is_file()]
    if not matches:
        raise EngineFailure(f"Engine completed without producing {suffix} under {root}")
    return max(matches, key=lambda path: path.stat().st_mtime_ns)


def _probe_import(module: str) -> bool:
    try:
        completed = subprocess.run(
            [_python(), "-c", f"import {module}"],
            check=False,
            capture_output=True,
            timeout=30,
        )
        return completed.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def engine_status() -> dict[str, dict[str, Any]]:
    liveportrait = _home("liveportrait")
    musetalk = _home("musetalk")
    ltx = _home("ltx")
    remotion = _home("remotion")

    checks = {
        "ffmpeg": {
            "ready": bool(shutil.which("ffmpeg") and shutil.which("ffprobe")),
            "licenseAccepted": True,
            "detail": "ffmpeg and ffprobe must both be on PATH",
        },
        "chatterbox": {
            "ready": _accepted("chatterbox") and _probe_import("chatterbox.tts"),
            "licenseAccepted": _accepted("chatterbox"),
            "detail": "pip package chatterbox-tts plus explicit model/license acceptance",
        },
        "liveportrait": {
            "ready": bool(
                _accepted("liveportrait")
                and liveportrait
                and (liveportrait / "inference.py").is_file()
                and (liveportrait / "pretrained_weights").exists()
            ),
            "licenseAccepted": _accepted("liveportrait"),
            "detail": "official inference.py and pretrained_weights under EDITFORGE_LIVEPORTRAIT_HOME",
        },
        "musetalk": {
            "ready": bool(
                _accepted("musetalk")
                and musetalk
                and (musetalk / "scripts" / "inference.py").is_file()
                and (musetalk / "models" / "musetalkV15" / "unet.pth").is_file()
            ),
            "licenseAccepted": _accepted("musetalk"),
            "detail": "MuseTalk 1.5 code and weights under EDITFORGE_MUSETALK_HOME",
        },
        "ltx": {
            "ready": bool(
                _accepted("ltx")
                and ltx
                and (ltx / "inference.py").is_file()
                and (ltx / "configs" / "ltxv-13b-0.9.8-distilled.yaml").is_file()
            ),
            "licenseAccepted": _accepted("ltx"),
            "detail": "official LTX-Video inference checkout and model access under EDITFORGE_LTX_HOME",
        },
        "remotion": {
            "ready": bool(
                remotion
                and (remotion / "node_modules" / ".bin" / "remotion").is_file()
                and (remotion / "src" / "index.ts").is_file()
            ),
            "licenseAccepted": True,
            "detail": "installed EditForge Remotion package under EDITFORGE_REMOTION_HOME",
        },
    }
    return checks


def require_engine(name: str) -> None:
    state = engine_status().get(name)
    if not state or not state["ready"]:
        detail = state["detail"] if state else "unknown engine"
        accepted = state.get("licenseAccepted") if state else None
        suffix = " License acceptance is still required." if accepted is False else ""
        raise EngineUnavailable(f"{name} is not ready: {detail}.{suffix}")


def chatterbox_voice(text: str, voice_reference: Path, output: Path, work_dir: Path) -> Path:
    require_engine("chatterbox")
    request = work_dir / "chatterbox-request.json"
    request.write_text(
        json.dumps(
            {
                "text": text,
                "voiceReference": str(voice_reference),
                "output": str(output),
                "device": os.environ.get("EDITFORGE_CHATTERBOX_DEVICE", "cuda"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    _run([_python(), str(Path(__file__).with_name("chatterbox_cli.py")), str(request)], cwd=work_dir)
    if not output.is_file() or output.stat().st_size == 0:
        raise EngineFailure("Chatterbox returned without a non-empty audio file")
    return output


def liveportrait_animate(source: Path, driving: Path, output_dir: Path) -> Path:
    require_engine("liveportrait")
    home = _home("liveportrait")
    assert home is not None
    output_dir.mkdir(parents=True, exist_ok=True)
    before = {path.resolve() for path in output_dir.rglob("*.mp4")}
    _run(
        [
            _python(),
            "inference.py",
            "-s",
            str(source),
            "-d",
            str(driving),
            "-o",
            str(output_dir),
            "--flag-pasteback",
            "--flag-do-crop",
            "--driving-option",
            "expression-friendly",
        ],
        cwd=home,
    )
    created = [path for path in output_dir.rglob("*.mp4") if path.resolve() not in before]
    return max(created, key=lambda path: path.stat().st_mtime_ns) if created else _newest(output_dir, ".mp4")


def musetalk_lipsync(video: Path, audio: Path, output_dir: Path, work_dir: Path) -> Path:
    require_engine("musetalk")
    home = _home("musetalk")
    assert home is not None
    output_dir.mkdir(parents=True, exist_ok=True)
    config = work_dir / "musetalk-job.yaml"
    result_name = "lipsynced.mp4"
    config.write_text(
        "task_0:\n"
        f"  video_path: {json.dumps(str(video))}\n"
        f"  audio_path: {json.dumps(str(audio))}\n"
        f"  result_name: {json.dumps(result_name)}\n",
        encoding="utf-8",
    )
    _run(
        [
            _python(),
            "-m",
            "scripts.inference",
            "--inference_config",
            str(config),
            "--result_dir",
            str(output_dir),
            "--unet_model_path",
            str(home / "models" / "musetalkV15" / "unet.pth"),
            "--unet_config",
            str(home / "models" / "musetalkV15" / "musetalk.json"),
            "--whisper_dir",
            str(home / "models" / "whisper"),
            "--version",
            "v15",
            "--fps",
            "25",
            "--use_float16",
        ],
        cwd=home,
    )
    return _newest(output_dir, ".mp4")


def ltx_generate(
    prompt: str,
    conditioning: Iterable[Path],
    output: Path,
    *,
    seconds: int = 5,
    seed: int = 17,
) -> Path:
    require_engine("ltx")
    home = _home("ltx")
    assert home is not None
    frames = max(9, ((seconds * 24 - 1) // 8) * 8 + 1)
    args = [
        _python(),
        "inference.py",
        "--prompt",
        prompt,
        "--height",
        "1248",
        "--width",
        "704",
        "--num_frames",
        str(frames),
        "--seed",
        str(seed),
        "--pipeline_config",
        "configs/ltxv-13b-0.9.8-distilled.yaml",
        "--output_path",
        str(output),
    ]
    refs = list(conditioning)
    if refs:
        args.extend(["--conditioning_media_paths", *[str(path) for path in refs]])
        args.extend(["--conditioning_start_frames", *["0" for _ in refs]])
    _run(args, cwd=home)
    if not output.is_file():
        candidate = _newest(output.parent, ".mp4")
        shutil.copy2(candidate, output)
    return output


def media_probe(path: Path) -> dict[str, Any]:
    require_engine("ffmpeg")
    completed = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=index,codec_type,width,height,r_frame_rate,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if completed.returncode != 0:
        raise EngineFailure(f"ffprobe failed for {path.name}: {(completed.stderr or '').strip()}")
    return json.loads(completed.stdout)


def _vertical_filter(target_duration: float | None) -> str:
    filters = [
        "scale=2160:3840:force_original_aspect_ratio=decrease:flags=lanczos",
        "pad=2160:3840:(ow-iw)/2:(oh-ih)/2:color=0x050B12",
        "fps=24",
        "setsar=1",
        "format=yuv420p",
    ]
    if target_duration is not None:
        filters.insert(0, f"tpad=stop_mode=clone:stop_duration={target_duration}")
    return ",".join(filters)


def master_video(input_video: Path, output: Path, *, target_duration: float | None = None) -> Path:
    require_engine("ffmpeg")
    output.parent.mkdir(parents=True, exist_ok=True)
    probe = media_probe(input_video)
    has_audio = any(stream.get("codec_type") == "audio" for stream in probe.get("streams", []))
    args = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(input_video),
    ]
    if not has_audio:
        args.extend(["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"])
    args.extend([
        "-map",
        "0:v:0",
        "-map",
        "0:a:0" if has_audio else "1:a:0",
        "-vf",
        _vertical_filter(target_duration),
        "-af",
        f"apad=pad_dur={target_duration}" if target_duration is not None else "aresample=48000",
        "-c:v",
        "libx264",
        "-preset",
        os.environ.get("EDITFORGE_X264_PRESET", "slow"),
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
    ])
    if target_duration is not None:
        args.extend(["-t", f"{target_duration:.3f}"])
    elif not has_audio:
        args.append("-shortest")
    args.append(str(output))
    _run(args)
    verify_master(output, target_duration=target_duration)
    return output


def blank_video(output: Path, *, duration: float) -> Path:
    require_engine("ffmpeg")
    if not 0 < duration <= 180:
        raise EngineFailure(f"Blank segment duration is invalid: {duration}")
    output.parent.mkdir(parents=True, exist_ok=True)
    _run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"color=c=0x050B12:s=2160x3840:r=24:d={duration:.3f}",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "libx264",
            "-preset",
            os.environ.get("EDITFORGE_X264_PRESET", "slow"),
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-t",
            f"{duration:.3f}",
            "-movflags",
            "+faststart",
            str(output),
        ]
    )
    verify_master(output, target_duration=duration)
    return output


def concat_master(inputs: list[Path], output: Path, *, expected_count: int, target_duration: float | None) -> Path:
    require_engine("ffmpeg")
    if len(inputs) != expected_count:
        raise EngineFailure(f"Expected {expected_count} inputs, received {len(inputs)}")
    for path in inputs:
        if not path.is_file():
            raise EngineFailure(f"Missing concat input: {path}")
    output.parent.mkdir(parents=True, exist_ok=True)
    concat_file = output.with_suffix(".concat.txt")
    concat_file.write_text(
        "\n".join(f"file '{str(path).replace(chr(39), chr(39) + chr(92) + chr(39) + chr(39))}'" for path in inputs) + "\n",
        encoding="utf-8",
    )
    args = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        str(output),
    ]
    _run(args)
    verify_master(output, target_duration=target_duration)
    return output


def verify_master(path: Path, *, target_duration: float | None = None) -> dict[str, Any]:
    data = media_probe(path)
    video = next((stream for stream in data.get("streams", []) if stream.get("codec_type") == "video"), None)
    audio = next((stream for stream in data.get("streams", []) if stream.get("codec_type") == "audio"), None)
    if not video:
        raise EngineFailure("Master has no video stream")
    if (video.get("width"), video.get("height"), video.get("r_frame_rate")) != (2160, 3840, "24/1"):
        raise EngineFailure(
            f"Master spec mismatch: {video.get('width')}×{video.get('height')} at {video.get('r_frame_rate')}"
        )
    if not audio or str(audio.get("sample_rate")) != "48000" or int(audio.get("channels", 0)) != 2:
        raise EngineFailure("Master must contain stereo 48 kHz audio")
    duration = float(data.get("format", {}).get("duration", 0))
    if target_duration is not None and abs(duration - target_duration) > 0.125:
        raise EngineFailure(f"Master runtime {duration:.3f}s is outside the {target_duration:.3f}s target")
    return data


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
