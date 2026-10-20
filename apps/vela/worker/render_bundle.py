#!/usr/bin/env python3
"""Render a Vela media backup as an explicitly ungraded source-cut review.

No network, browser-state mutation, cloud service, or generated performance.
The output directory must be new. status.json and receipt.json are job evidence.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import time
import zipfile

HASH = re.compile(r"[0-9a-f]{64}\Z")
MAX_BYTES = 2 * 1024**3
MAX_SOURCE = 256 * 1024**2
SH135 = "0c82b6cfb118ae559e5ab49776dc10551f972fa21df0e5582c044e0d347cb310"
FORMATS = "mov,matroska,webm,wav,mp3,ogg,flac,png_pipe,jpeg_pipe,webp_pipe"


class Cancelled(Exception):
    pass


def digest(path):
    with open(path, "rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def atomic_json(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


def verify_intermediates(entries, output, phase):
    """Reject a segment changed after validation, including during muxing."""
    for path, expected in entries:
        actual = {"bytes": path.stat().st_size, "sha256": digest(path)} if path.is_file() else None
        if actual != expected:
            atomic_json(output / "verification-failure.json", {
                "phase": phase, "segment": path.name, "expected": expected, "actual": actual,
            })
            raise ValueError(f"Validated picture segment changed {phase}: {path.name}")


def run(args, timeout=600):
    """Bound subprocess lifetime; a cancellation also stops the child process."""
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               start_new_session=True)
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except BaseException:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
        raise
    if process.returncode:
        raise ValueError(f"{Path(args[0]).name} failed: {stderr.decode(errors='replace')[-3000:]}")
    return stdout


def probe(path, count=False, restricted=True):
    args = ["ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe"]
    if restricted:
        args += ["-format_whitelist", FORMATS]
    if count:
        args += ["-count_frames"]
    return json.loads(run(args + ["-show_streams", "-show_format", "-of", "json", str(path)], 120))


def number(value, label, low=0, high=3600):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f"Invalid {label}")
    return value


def frame(value, fps, label):
    exact = number(value, label) * fps
    rounded = round(exact)
    if abs(exact - rounded) > 1e-5:
        raise ValueError(f"{label} must be on the {fps} fps timeline grid")
    return rounded


def load_bundle(bundle, root):
    if bundle.stat().st_size > MAX_BYTES:
        raise ValueError("Bundle exceeds 2 GiB")
    with zipfile.ZipFile(bundle) as archive:
        entries = archive.infolist()
        names = [item.filename for item in entries]
        if len(entries) > 2000 or len(set(names)) != len(names) or sum(x.file_size for x in entries) > MAX_BYTES:
            raise ValueError("Duplicate entries or oversized bundle")
        for item in entries:
            if item.compress_type != zipfile.ZIP_STORED or item.flag_bits & 1 or item.file_size > MAX_SOURCE:
                raise ValueError("Only bounded, unencrypted Vela stored-ZIP entries are supported")
            if item.filename != "project.json" and not re.fullmatch(r"(?:media|booth)/[0-9a-f]{64}", item.filename):
                raise ValueError("Unsafe or unsupported archive path")
        if "project.json" not in names or archive.getinfo("project.json").file_size > 8 * 1024**2:
            raise ValueError("Missing or oversized project manifest")
        manifest = json.loads(archive.read("project.json"))
        if manifest.get("schema") != "vela.project-bundle/v1" or not isinstance(manifest.get("sources"), list):
            raise ValueError("Unsupported Vela bundle schema")
        sources = {}
        declared = {"project.json"}
        for source in manifest["sources"]:
            sha = source.get("sha256", "")
            store, key = source.get("store"), source.get("id")
            if not isinstance(sha, str) or not HASH.fullmatch(sha) or store not in ("media", "booth"):
                raise ValueError("Invalid source identity")
            if not isinstance(key, str) or key in sources or (store == "media" and key != "media-" + sha):
                raise ValueError("Duplicate or invalid source ID")
            path = f"{store}/{sha}"
            if source.get("path") != path or path not in names:
                raise ValueError("Missing source or invalid path")
            data = archive.read(path)  # ZIP reader checks CRC as well.
            if len(data) != source.get("size") or hashlib.sha256(data).hexdigest() != sha:
                raise ValueError("Source checksum mismatch")
            target = root / store / sha
            target.parent.mkdir(exist_ok=True)
            if not target.exists():
                target.write_bytes(data)
            sources[key] = {**source, "file": target}
            declared.add(path)
        if declared != set(names):
            raise ValueError("Unlisted bundle entries")
    return manifest, sources


def make_plan(project, sources):
    fps = project.get("fps", 24)
    if isinstance(fps, bool) or fps not in (24, 25, 30, 50, 60):
        raise ValueError("Unsupported timeline frame rate")
    aspect = project.get("aspect")
    if aspect not in ("16:9", "9:16", "1:1"):
        raise ValueError("Unsupported aspect ratio")
    if project.get("captions"):
        raise ValueError("Caption baking is not implemented; source-cut export refuses captions")
    media = project.get("media", [])
    if not isinstance(media, list) or len(media) > 1000:
        raise ValueError("Invalid media inventory")
    assets = {}
    for asset in media:
        key = asset.get("id")
        source = sources.get(key)
        if key in assets or not source or asset.get("sha256") != source["sha256"] or asset.get("bytes") != source["size"]:
            raise ValueError("Asset metadata does not match original bytes")
        if asset.get("kind") not in ("video", "audio", "image"):
            raise ValueError("Invalid media kind")
        assets[key] = asset
    clips = project.get("clips")
    if not isinstance(clips, list) or not 0 < len(clips) <= 500:
        raise ValueError("Expected 1–500 clips")
    ids = set()
    prepared = []
    for clip in clips:
        if not isinstance(clip.get("id"), str) or clip["id"] in ids:
            raise ValueError("Invalid or duplicate clip ID")
        ids.add(clip["id"])
        asset = assets.get(clip.get("mediaId"))
        track = clip.get("track")
        if not asset or clip.get("audioId") or isinstance(track, bool) or track not in (0, 3, 4, 5, 6, 7):
            raise ValueError("Only original media on picture track 0 and audio lanes 3–7 can render; demo/title/score/Booth clips are unsupported")
        if (track == 0 and (clip.get("kind") != "picture" or asset["kind"] == "audio")) or (track != 0 and asset["kind"] == "image"):
            raise ValueError("Media does not match its track")
        start = frame(clip.get("start"), fps, "clip start")
        duration = frame(clip.get("duration"), fps, "clip duration")
        source_in = frame(clip.get("sourceIn", 0), fps, "source in")
        if duration < 1 or start + duration > 3600 * fps:
            raise ValueError("Invalid clip bounds")
        gain = number(clip.get("gainDb", 0), "gain dB", -60, 12)
        fades = [number(clip.get(k, 0), k, 0, duration / fps) for k in ("fadeIn", "fadeOut")]
        if "muted" in clip and not isinstance(clip["muted"], bool):
            raise ValueError("Invalid mute state")
        prepared.append({**clip, "a": asset, "s": start, "e": start + duration, "n": duration, "i": source_in, "gain": gain, "fades": fades})
    total = max(8 * fps, max(c["e"] for c in prepared))  # Matches Vela projectDuration.
    solo = project.get("soloTrack")
    if solo is not None and (isinstance(solo, bool) or solo not in range(8)):
        raise ValueError("Invalid solo track")
    boundaries = sorted({0, total, *(c[k] for c in prepared if c["track"] == 0 for k in ("s", "e"))})
    spans = []
    for start, end in zip(boundaries, boundaries[1:]):
        hits = [c for c in prepared if c["track"] == 0 and c["s"] <= start < c["e"]]
        spans.append((start, end, hits[-1] if hits else None))
    audio = [(c["s"], c["e"], c) for c in prepared if c["track"] != 0]
    audio += [(s, e, c) for s, e, c in spans if c is not None]
    audio = [(s, e, c) for s, e, c in audio if not c.get("muted", False) and (solo is None or c["track"] == solo) and c["a"]["kind"] != "image"]
    return fps, total, spans, audio, prepared


def ffmpeg(args):
    return run(["ffmpeg", "-v", "error", "-nostdin", "-n", "-threads", "2", "-filter_threads", "1", "-filter_complex_threads", "1", *args])


def input_args(path):
    return ["-protocol_whitelist", "file,pipe", "-format_whitelist", FORMATS, "-i", str(path)]


def render(bundle, output, height=720):
    if height not in (360, 720, 1080):
        raise ValueError("Height must be 360, 720 or 1080")
    output.mkdir(mode=0o700, parents=False, exist_ok=False)
    started = time.time()
    def status(state, **extra):
        value = {"state": state, "mode": "source-cut-review", "elapsed_seconds": round(time.time() - started, 2), **extra}
        atomic_json(output / "status.json", value)
        print(json.dumps(value), flush=True)
    status("validating")
    try:
        bundle_hash = digest(bundle)
        renderer_hash = digest(Path(__file__))
        with tempfile.TemporaryDirectory(prefix=".work-", dir=output) as temporary:
            root = Path(temporary)
            manifest, sources = load_bundle(bundle, root)
            project = manifest["project"]
            fps, total, spans, audio, clips = make_plan(project, sources)
            ratio = {"16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1}[project["aspect"]]
            width = round(height * ratio / 2) * 2
            inspected = {}
            for clip in clips:
                key = clip["mediaId"]
                if key not in inspected:
                    inspected[key] = probe(sources[key]["file"])
                info = inspected[key]
                streams = info["streams"]
                video = next((s for s in streams if s["codec_type"] == "video"), None)
                has_audio = any(s["codec_type"] == "audio" for s in streams)
                if any(abs(float(s.get("start_time", 0))) > 1 / 48000 for s in streams if s["codec_type"] in ("video", "audio")):
                    raise ValueError("Non-zero source stream start offsets need an explicit conform before rendering")
                if clip["track"] == 0 and (not video or video.get("width", 0) * video.get("height", 0) > 40_000_000):
                    raise ValueError("Invalid or oversized source video")
                if clip["track"] != 0 and not has_audio:
                    raise ValueError("Audio lane source has no audio stream")
                if video and (video.get("color_transfer") in ("smpte2084", "arib-std-b67") or video.get("color_primaries") == "bt2020"):
                    raise ValueError("HDR/wide-gamut conversion is not implemented")
                if clip["a"]["kind"] != "image":
                    stream_type = "video" if clip["track"] == 0 else "audio"
                    stream = next(s for s in streams if s["codec_type"] == stream_type)
                    length = float(stream.get("duration", info["format"].get("duration", 0)))
                    if clip["i"] + clip["n"] > length * fps + 1e-4:
                        raise ValueError("Clip extends past original source duration")
            video_parts = []
            segment_identities = []
            for index, (start, end, clip) in enumerate(spans):
                status("rendering_picture", segment=index + 1, segments=len(spans))
                part = root / f"picture-{index:04d}.mp4"
                frames = end - start
                if clip is None:
                    args = ["-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r={fps}"]
                    filters = "format=yuv420p"
                else:
                    asset = clip["a"]
                    args = (["-loop", "1", "-framerate", str(fps)] if asset["kind"] == "image" else []) + input_args(sources[clip["mediaId"]]["file"])
                    offset = 0 if asset["kind"] == "image" else clip["i"] + start - clip["s"]
                    filters = f"fps={fps}:round=up:start_time=0,trim=start_frame={offset}:end_frame={offset + frames},setpts=PTS-STARTPTS,scale={width}:{height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=yuv420p"
                ffmpeg(args + ["-map", "0:v:0", "-an", "-vf", filters, "-frames:v", str(frames), "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-threads", "2", str(part)])
                identity = {"bytes": part.stat().st_size, "sha256": digest(part)}
                part_info = probe(part, count=True)
                actual = int(next(s for s in part_info["streams"] if s["codec_type"] == "video")["nb_read_frames"])
                if actual != frames:
                    raise ValueError(f"Picture segment frame mismatch: expected {frames}, got {actual}")
                verify_intermediates([(part, identity)], output, "during segment validation")
                segment_identities.append((part, identity))
                video_parts.append(part)
            status("mixing_audio")
            # Decode every selected interval into PCM at its exact source offset;
            # apply fades on the original clip clock, then delay in sample units.
            args = ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
            filters = [f"[0:a]atrim=end_sample={total * 48000 // fps},asetpts=PTS-STARTPTS[base]"]
            labels = ["[base]"]
            selected_audio = []
            for start, end, clip in audio:
                info = inspected[clip["mediaId"]]
                if not any(s["codec_type"] == "audio" for s in info["streams"]):
                    continue  # Silent picture does not mute the separate lanes.
                index = len(selected_audio) + 1
                args += input_args(sources[clip["mediaId"]]["file"])
                offset = (clip["i"] + start - clip["s"]) / fps
                duration = (end - start) / fps
                local = (start - clip["s"]) / fps
                fade_in, fade_out = clip["fades"]
                fade = "1"
                if fade_in:
                    fade = f"min({fade}\\,max(0\\,(t+{local:.12f})/{fade_in:.12f}))"
                if fade_out:
                    fade = f"min({fade}\\,max(0\\,({clip['n']/fps:.12f}-t-{local:.12f})/{fade_out:.12f}))"
                gain = f"{10 ** (clip['gain'] / 20):.12f}*{fade}"
                # Volume updates once per audio frame (bounded by asetnsamples).
                filters.append(f"[{index}:a:0]aresample=48000,atrim=start={offset:.12f}:duration={duration:.12f},asetpts=PTS-STARTPTS,asetnsamples=n=64:p=0,volume='{gain}':eval=frame,adelay={start * 48000 // fps}S:all=1[a{index}]")
                labels.append(f"[a{index}]")
                selected_audio.append({"clip": clip["id"], "start_frame": start, "end_frame": end, "source_in_seconds": offset})
            filters.append("".join(labels) + f"amix=inputs={len(labels)}:duration=first:normalize=0,atrim=end_sample={total * 48000 // fps}[mixed]")
            mix = root / "mix.wav"
            ffmpeg(args + ["-filter_complex", ";".join(filters), "-map", "[mixed]", "-c:a", "pcm_f32le", str(mix)])
            # Reject overload instead of quietly limiting or clipping the user's mix.
            peak_result = run(["ffmpeg", "-v", "info", "-nostdin", "-i", str(mix), "-af", "astats=metadata=1:reset=0,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-", "-f", "null", "-"])
            peaks = [float(x) for x in re.findall(rb"Peak_level=(-?[\d.]+)", peak_result)]
            peak_db = max(peaks) if peaks else None
            if peak_db is not None and peak_db > 0:
                raise ValueError(f"Audio mix clips ({peak_db:.2f} dBFS); lower gain and retry")
            concat = root / "pictures.txt"
            concat.write_text("".join(f"file '{p.name}'\n" for p in video_parts))
            result = root / "source-cut-review.mp4"
            verify_intermediates(segment_identities, output, "before muxing")
            ffmpeg(["-f", "concat", "-safe", "1", "-i", str(concat), "-i", str(mix), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{total/fps:.12f}", "-movflags", "+faststart", str(result)])
            verify_intermediates(segment_identities, output, "during muxing")
            status("verifying")
            output_info = probe(result, count=True)
            video = next(s for s in output_info["streams"] if s["codec_type"] == "video")
            sound = next(s for s in output_info["streams"] if s["codec_type"] == "audio")
            if int(video["nb_read_frames"]) != total or video["r_frame_rate"] != f"{fps}/1":
                atomic_json(output / "verification-failure.json", {"expected_frames": total, "expected_fps": fps, "output_probe": output_info})
                raise ValueError(f"Output timebase/frame mismatch: expected {total} at {fps}/1, got {video['nb_read_frames']} at {video['r_frame_rate']}; duration={video.get('duration')}")
            if abs(float(sound["duration"]) - total / fps) > 1024 / 48000 or abs(float(sound.get("start_time", 0))) > 1 / 48000:
                raise ValueError("Output audio duration/start mismatch")
            ffmpeg(["-i", str(result), "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-"])
            for source in sources.values():
                if digest(source["file"]) != source["sha256"]:
                    raise ValueError("Source changed during render")
            if digest(bundle) != bundle_hash:
                raise ValueError("Source bundle changed during render; refusing a mismatched receipt")
            receipt = {"schema": "vela.source-cut-receipt/v1", "mode": "source-cut-review", "creative_approval": False,
                       "renderer_sha256": renderer_hash,
                       "project_id": project.get("id"), "bundle_sha256": bundle_hash, "output_sha256": digest(result),
                       "frames": total, "fps": fps, "duration_seconds": total / fps, "width": width, "height": height,
                       "audio_peak_dbfs_before_aac": peak_db, "audio_intervals": selected_audio,
                       "sources": [{"sha256": s["sha256"], "bytes": s["size"], "locked_sh135": s["sha256"] == SH135} for s in sources.values()],
                       "not_rendered": ["grade", "Enhance skin", "Still layers", "Stage", "Booth animation", "generated score"],
                       "limits": ["Unrepaired source review, not a premiere master", "8-bit SDR H.264/AAC; compression is not lossless", "Audio fades update per 64 samples; not true-peak or loudness mastering", "No tracking, paint, mask removal, stop or resume performance created"],
                       "ffmpeg_version": run(["ffmpeg", "-version"]).decode().splitlines()[0], "output_probe": output_info}
            result.rename(output / result.name)
            atomic_json(output / "receipt.json", receipt)
        status("completed", frames=total, fps=fps, output="source-cut-review.mp4")
        return receipt
    except BaseException as error:
        status("cancelled" if isinstance(error, (Cancelled, KeyboardInterrupt)) else "failed", error=str(error))
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("output", type=Path, help="new job directory; existing paths are refused")
    parser.add_argument("--source-cut-review", required=True, action="store_true", help="explicitly acknowledge grade/skin/stage are not baked")
    parser.add_argument("--height", type=int, choices=(360, 720, 1080), default=720)
    args = parser.parse_args()
    for executable in ("ffmpeg", "ffprobe"):
        if not shutil.which(executable):
            parser.error(f"{executable} is required")
    def cancel(_signum, _frame):
        raise Cancelled("Render cancelled; source bundle unchanged")
    signal.signal(signal.SIGTERM, cancel)
    try:
        render(args.bundle.resolve(), args.output.resolve(), args.height)
    except (ValueError, OSError, Cancelled, KeyboardInterrupt, subprocess.SubprocessError, zipfile.BadZipFile) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
