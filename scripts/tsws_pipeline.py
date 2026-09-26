#!/usr/bin/env python3
"""Offline TSWS shot planning, QC and silent picture-proof assembly.

This deliberately has no provider client, credentials, network calls, or
master-export path. Paid generation stays behind EditForge's existing gates.
"""

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path


CHECKS = (
    "identity", "wardrobe", "performance", "environment", "continuity",
    "threadCount", "anahataPlacement", "framing", "rightsAndConsent",
)
SHOT_ID = re.compile(r"^TSWS-S\d{2}E\d{2}-SH\d{3}$")


class GateError(Exception):
    pass


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise GateError(f"cannot read JSON {path}: {exc}") from exc


def frames_at(timecode, fps):
    if not re.fullmatch(r"\d{2}:\d{2}", timecode):
        raise GateError(f"invalid minute:second timecode: {timecode}")
    minute, second = map(int, timecode.split(":"))
    if second >= 60:
        raise GateError(f"invalid second in timecode: {timecode}")
    return (minute * 60 + second) * fps


def validate(plan):
    if plan.get("schema") != "tsws.shot-plan.v1":
        raise GateError("shot plan schema must be tsws.shot-plan.v1")
    fps = plan.get("frameRate")
    if fps not in (24, 25, 30) or isinstance(fps, bool):
        raise GateError("frameRate must be 24, 25 or 30")
    for key in ("width", "height", "proofFrames", "targetFrames"):
        if type(plan.get(key)) is not int or plan[key] <= 0:
            raise GateError(f"{key} must be a positive integer")
    if plan["targetFrames"] != 677 * fps:
        raise GateError("Episode 1 target must equal 11:17 at the selected fps")
    if plan["proofFrames"] > plan["targetFrames"]:
        raise GateError("proof exceeds episode target")
    canon = plan.get("canon", {})
    if canon.get("closeUpFacesAllowed") is not True:
        raise GateError("the later close-up ruling must be represented")
    if (canon.get("goldThreadMaxConcurrent"), canon.get("anahataOccurrences"),
        canon.get("protectedSilenceFrames")) != (1, 1, 4 * fps):
        raise GateError("gold thread, Anahata and four-second silence locks changed")
    if canon.get("goldThreadColor") != "#FFC878" or canon.get("anahataColor") != "#3ED58A":
        raise GateError("canon VFX colors changed")
    anchors = plan.get("beatAnchors", [])
    if not anchors or any(not isinstance(a, list) or len(a) != 2 for a in anchors):
        raise GateError("beatAnchors must contain [timecode, brief] pairs")
    times = [frames_at(a[0], fps) for a in anchors]
    if times != sorted(set(times)) or times[0] != 0 or times[-1] != plan["targetFrames"]:
        raise GateError("beat anchors must be ordered, unique and end at 11:17")
    shots = plan.get("shots")
    if not isinstance(shots, list) or not shots:
        raise GateError("at least one proof shot is required")
    cursor, seen = 0, set()
    for shot in shots:
        sid = shot.get("id", "")
        if not SHOT_ID.fullmatch(sid) or sid in seen:
            raise GateError(f"invalid or duplicate shot ID: {sid}")
        seen.add(sid)
        if sid[:11] != plan.get("episode"):
            raise GateError(f"shot {sid} belongs to another episode")
        start, end = shot.get("inFrame"), shot.get("outFrame")
        if type(start) is not int or type(end) is not int or start != cursor or end <= start:
            raise GateError(f"shot {sid} must follow the previous shot without a gap or overlap")
        if not shot.get("brief") or not shot.get("providerLane"):
            raise GateError(f"shot {sid} needs a brief and provider lane")
        if shot.get("costApproval") != "required before any paid provider submit":
            raise GateError(f"shot {sid} lacks its paid-generation gate")
        cursor = end
    if cursor != plan["proofFrames"]:
        raise GateError("shots must fill the proof exactly")
    return shots


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def within(root, relative):
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
        raise GateError("QC file must be a relative path inside the work directory")
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise GateError("QC file escapes the work directory")
    return path


def probe(path):
    try:
        proc = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height,avg_frame_rate,duration:format=duration",
             "-of", "json", str(path)], capture_output=True, text=True, check=True,
        )
        data = json.loads(proc.stdout)
        stream = data["streams"][0]
        return (int(stream["width"]), int(stream["height"]),
                float(stream.get("duration") or data["format"]["duration"]),
                Fraction(stream["avg_frame_rate"]))
    except (OSError, subprocess.CalledProcessError, ValueError, KeyError, IndexError) as exc:
        raise GateError(f"cannot probe video {path.name}: {exc}") from exc


def check_shot(plan, work, shot):
    sid = shot["id"]
    receipt = read_json(work / "qc" / f"{sid}.json")
    if receipt.get("schema") != "tsws.shot-qc.v1" or receipt.get("shotId") != sid:
        raise GateError(f"{sid}: QC schema or ID mismatch")
    if receipt.get("decision") != "pass" or not receipt.get("reviewer") or not receipt.get("reviewedAt"):
        raise GateError(f"{sid}: a named, dated human QC pass is required")
    try:
        datetime.fromisoformat(receipt["reviewedAt"].replace("Z", "+00:00"))
    except ValueError as exc:
        raise GateError(f"{sid}: invalid QC timestamp") from exc
    checks = receipt.get("checks", {})
    if any(checks.get(key) is not True for key in CHECKS):
        raise GateError(f"{sid}: all nine QC checks must pass")
    path = within(work, receipt.get("file"))
    if not path.is_file() or not re.fullmatch(r"[a-f0-9]{64}", receipt.get("sha256", "")):
        raise GateError(f"{sid}: missing media or invalid SHA-256 receipt")
    if sha256(path) != receipt["sha256"]:
        raise GateError(f"{sid}: media SHA-256 does not match its QC receipt")
    width, height, duration, rate = probe(path)
    if (width, height) != (plan["width"], plan["height"]):
        raise GateError(f"{sid}: wrong video dimensions {width}x{height}")
    needed = (shot["outFrame"] - shot["inFrame"]) / plan["frameRate"]
    if duration + 0.01 < needed:
        raise GateError(f"{sid}: clip is too short ({duration:.3f}s < {needed:.3f}s)")
    if rate <= 0:
        raise GateError(f"{sid}: invalid video frame rate")
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("validate", "plan", "receipt-template", "inspect", "assemble"))
    parser.add_argument("manifest", type=Path)
    parser.add_argument("extra", nargs="*")
    args = parser.parse_args()
    plan = read_json(args.manifest)
    shots = validate(plan)
    if args.action == "validate":
        print(f"Valid draft proof: {len(shots)} shots, {plan['proofFrames'] / plan['frameRate']:.2f}s; full episode pending timeline lock")
    elif args.action == "plan":
        print(json.dumps({"schema": "tsws.work-orders.v1", "episode": plan["episode"],
                          "status": plan["status"], "referencePolicy": plan["referencePolicy"],
                          "shots": shots, "timelineQuestions": plan["timelineQuestions"]}, indent=2))
    elif args.action == "receipt-template":
        if len(args.extra) != 1 or args.extra[0] not in {s["id"] for s in shots}:
            raise GateError("receipt-template requires a shot ID from this manifest")
        print(json.dumps({"schema": "tsws.shot-qc.v1", "shotId": args.extra[0],
                          "file": f"media/{args.extra[0]}.mp4", "sha256": "",
                          "reviewer": "", "reviewedAt": "", "decision": "pending",
                          "checks": dict.fromkeys(CHECKS, False), "notes": ""}, indent=2))
    else:
        if (args.action == "inspect" and len(args.extra) != 1 or
            args.action == "assemble" and len(args.extra) != 2):
            raise GateError(f"{args.action} requires WORK_DIR" + (" OUTPUT.mp4" if args.action == "assemble" else ""))
        work = Path(args.extra[0]).resolve()
        paths = [check_shot(plan, work, shot) for shot in shots]
        if args.action == "inspect":
            print(f"Ready for silent picture preview: {len(paths)} approved, hashed and probed shots")
            return
        output = Path(args.extra[1]).resolve()
        if output.exists():
            raise GateError(f"output already exists: {output}")
        filters = []
        for index, shot in enumerate(shots):
            seconds = (shot["outFrame"] - shot["inFrame"]) / plan["frameRate"]
            filters.append(f"[{index}:v]trim=duration={seconds:.6f},setpts=PTS-STARTPTS,"
                           f"fps={plan['frameRate']},format=yuv420p[v{index}]")
        filters.append("".join(f"[v{i}]" for i in range(len(shots))) +
                       f"concat=n={len(shots)}:v=1:a=0[out]")
        command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-n"]
        for path in paths:
            command += ["-i", str(path)]
        command += ["-filter_complex", ";".join(filters), "-map", "[out]", "-an",
                    "-frames:v", str(plan["proofFrames"]), "-c:v", "libx264", "-pix_fmt", "yuv420p", str(output)]
        try:
            subprocess.run(command, check=True)
        except (OSError, subprocess.CalledProcessError) as exc:
            output.unlink(missing_ok=True)
            raise GateError(f"FFmpeg picture preview failed: {exc}") from exc
        print(f"Silent picture preview: {output} ({sha256(output)})")


if __name__ == "__main__":
    try:
        main()
    except GateError as error:
        print(f"TSWS gate: {error}", file=sys.stderr)
        sys.exit(2)
