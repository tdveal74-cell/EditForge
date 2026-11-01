"""Contract and actual FFmpeg tests. Synthetic media is clearly test-only."""
import array
import contextlib
import hashlib
import io
import json
from pathlib import Path
import signal
import struct
import subprocess
import sys
import tempfile
import unittest
import wave
import zipfile

from render_bundle import Cancelled, load_bundle, make_plan, render, run


def pack(path, project, files):
    sources = []
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED) as archive:
        for asset, data in files:
            source_path = f"media/{asset['sha256']}"
            sources.append({"id": asset["id"], "store": "media", "path": source_path, "mime": asset["mime"], "size": len(data), "sha256": asset["sha256"]})
            archive.writestr(source_path, data)
        archive.writestr("project.json", json.dumps({"schema": "vela.project-bundle/v1", "project": project, "sources": sources}))


def asset(data, kind, mime):
    sha = hashlib.sha256(data).hexdigest()
    return {"id": "media-" + sha, "sha256": sha, "bytes": len(data), "kind": kind, "mime": mime, "name": "SYNTHETIC TEST ONLY"}


def clip(key, source, start=0, duration=1, source_in=0, track=0, **extra):
    return {"id": key, "kind": "picture" if track == 0 else "voice", "track": track, "mediaId": source["id"], "start": start, "duration": duration, "sourceIn": source_in, **extra}


class RenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="vela-render-test-")
        cls.root = Path(cls.temp.name)
        source = cls.root / "SYNTHETIC_FRAME_COUNTER.mp4"
        run(["ffmpeg", "-v", "error", "-nostdin", "-f", "lavfi", "-i", "color=s=64x36:r=24:d=2,geq=lum='16+N*4':cb=128:cr=128", "-c:v", "libx264", "-crf", "0", "-preset", "ultrafast", str(source)])
        cls.video_data = source.read_bytes()
        cls.video = asset(cls.video_data, "video", "video/mp4")
        wav = io.BytesIO()
        with wave.open(wav, "wb") as stream:
            stream.setnchannels(1)
            stream.setsampwidth(2)
            stream.setframerate(48000)
            # Known marker at 0.25 s. Its export position must include source-in.
            samples = [0] * 48000
            for i in range(12000, 14400):
                samples[i] = 3000 if i % 48 < 24 else -3000
            stream.writeframes(struct.pack("<48000h", *samples))
        cls.audio_data = wav.getvalue()
        cls.audio = asset(cls.audio_data, "audio", "audio/wav")

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def project(self):
        return {"id": "SYNTHETIC-TEST", "name": "SYNTHETIC TEST ONLY", "fps": 30, "aspect": "16:9", "media": [self.video, self.audio], "captions": [], "clips": [clip("v1", self.video, duration=7/30), clip("v2", self.video, start=7/30, duration=23/30, source_in=7/30), clip("a1", self.audio, start=1, duration=0.5, source_in=0.1, track=3)]}

    def write_bundle(self, name, project=None):
        path = self.root / (name + ".vela.zip")
        pack(path, project or self.project(), [(self.video, self.video_data), (self.audio, self.audio_data)])
        return path

    def test_real_frame_mapping_split_audio_marker_and_receipt(self):
        bundle = self.write_bundle("render")
        original = hashlib.sha256(bundle.read_bytes()).hexdigest()
        with contextlib.redirect_stdout(io.StringIO()):
            result = render(bundle, self.root / "output", 360)
        self.assertEqual(result["frames"], 240)
        self.assertEqual(result["fps"], 30)
        self.assertFalse(result["creative_approval"])
        movie = self.root / "output/source-cut-review.mp4"
        # Verify every source frame in the first second, including the split.
        pixels = run(["ffmpeg", "-v", "error", "-i", str(movie), "-map", "0:v:0", "-frames:v", "30", "-vf", "scale=2:2,format=yuv420p", "-f", "rawvideo", "-"])[::6]
        self.assertEqual(len(pixels), 30)
        for n, value in enumerate(pixels):
            expected = 16 + (n * 24 // 30) * 4
            self.assertLessEqual(abs(value - expected), 1, f"frame {n}")
        pcm = array.array("f", run(["ffmpeg", "-v", "error", "-i", str(movie), "-map", "0:a:0", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"]))
        strong = [i for i, value in enumerate(pcm) if abs(value) > 0.03]
        self.assertTrue(strong)
        # Original 0.25 s marker, minus 0.10 source in, plus 1.0 timeline start.
        self.assertLess(abs(strong[0] / 48000 - 1.15), 0.002)
        self.assertLess(abs(strong[-1] / 48000 - 1.20), 0.002)
        self.assertEqual(hashlib.sha256(bundle.read_bytes()).hexdigest(), original)
        self.assertEqual(json.loads((self.root / "output/status.json").read_text())["state"], "completed")
        with self.assertRaises(FileExistsError):
            render(bundle, self.root / "output", 360)

    def test_archive_traversal_and_checksum_are_refused(self):
        bundle = self.write_bundle("bad-path")
        with zipfile.ZipFile(bundle, "a") as archive:
            archive.writestr("../outside", "unsafe")
        with tempfile.TemporaryDirectory(dir=self.root) as dest, self.assertRaisesRegex(ValueError, "path"):
            load_bundle(bundle, Path(dest))
        bundle = self.root / "bad-checksum.vela.zip"
        pack(bundle, self.project(), [(self.video, self.video_data[:-1] + b"x"), (self.audio, self.audio_data)])
        with tempfile.TemporaryDirectory(dir=self.root) as dest, self.assertRaisesRegex(ValueError, "checksum"):
            load_bundle(bundle, Path(dest))

    def test_overlap_visibility_solo_and_unsupported_features(self):
        bundle = self.write_bundle("plan")
        with tempfile.TemporaryDirectory(dir=self.root) as dest:
            manifest, sources = load_bundle(bundle, Path(dest))
            project = manifest["project"]
            project["clips"].append(clip("top", self.video, start=0.5, duration=0.5))
            project["soloTrack"] = 3
            _, _, spans, audio, _ = make_plan(project, sources)
            self.assertEqual(next(c for s, e, c in spans if s == 15)["id"], "top")
            self.assertTrue(all(c["track"] == 3 for s, e, c in audio))
            project["captions"] = [{"text": "must not silently disappear"}]
            with self.assertRaisesRegex(ValueError, "Caption"):
                make_plan(project, sources)
            project["captions"] = []
            project["clips"][0]["start"] = 0.001
            with self.assertRaisesRegex(ValueError, "grid"):
                make_plan(project, sources)

    def test_failed_job_and_cancelled_job_leave_no_movie(self):
        bad = self.project()
        bad["clips"][0]["duration"] = 3
        bundle = self.write_bundle("past-end", bad)
        output = self.root / "failed"
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(ValueError, "past original"):
            render(bundle, output, 360)
        self.assertEqual(json.loads((output / "status.json").read_text())["state"], "failed")
        self.assertFalse((output / "source-cut-review.mp4").exists())
        # Exercise cancellation state handling independently of a subprocess.
        import render_bundle
        old_probe = render_bundle.probe
        try:
            def cancel_probe(*args, **kwargs):
                raise Cancelled("test cancellation")
            render_bundle.probe = cancel_probe
            output = self.root / "cancelled"
            with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(Cancelled):
                render(self.write_bundle("cancel"), output, 360)
            self.assertEqual(json.loads((output / "status.json").read_text())["state"], "cancelled")
            self.assertFalse(any(output.glob(".work-*")))
        finally:
            render_bundle.probe = old_probe

    def test_real_cli_cancellation_and_still_import(self):
        project = self.project()
        project["clips"] = [clip(f"v{i}", self.video, start=i*2, duration=2) for i in range(100)]
        bundle = self.write_bundle("long-cancel", project)
        output = self.root / "cli-cancel"
        process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("render_bundle.py")), str(bundle), str(output), "--source-cut-review", "--height", "360"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            while True:
                line = process.stdout.readline()
                if not line:
                    self.fail("Render exited before cancellation point")
                if json.loads(line)["state"] == "rendering_picture":
                    process.send_signal(signal.SIGTERM)
                    break
            process.communicate(timeout=10)
            self.assertNotEqual(process.returncode, 0)
            self.assertEqual(json.loads((output / "status.json").read_text())["state"], "cancelled")
            self.assertFalse((output / "source-cut-review.mp4").exists())
            self.assertFalse(any(output.glob(".work-*")))
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()
        png = self.root / "SYNTHETIC_RED.png"
        run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=red:s=32x32", "-frames:v", "1", str(png)])
        data = png.read_bytes()
        still = asset(data, "image", "image/png")
        project = {**self.project(), "media": [still], "clips": [clip("still", still, duration=1)]}
        bundle = self.root / "still.vela.zip"
        pack(bundle, project, [(still, data)])
        with contextlib.redirect_stdout(io.StringIO()):
            receipt = render(bundle, self.root / "still-out", 360)
        self.assertEqual(receipt["frames"], 240)
        self.assertEqual(receipt["sources"][0]["sha256"], still["sha256"])

    def test_overloaded_mix_fails_instead_of_silently_clipping(self):
        project = self.project()
        project["clips"] = [clip("picture", self.video)] + [clip(f"loud-{i}", self.audio, duration=1, track=i, gainDb=12) for i in range(3, 7)]
        output = self.root / "clipped"
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(ValueError, "mix clips"):
            render(self.write_bundle("clipped", project), output, 360)
        self.assertFalse((output / "source-cut-review.mp4").exists())

    def test_bundle_changed_during_render_cannot_receive_success_receipt(self):
        import render_bundle
        bundle = self.write_bundle("changed-mid-render")
        output = self.root / "changed-mid-render"
        original_probe = render_bundle.probe
        changed = False
        try:
            def mutate_after_load(*args, **kwargs):
                nonlocal changed
                if not changed:
                    bundle.write_bytes(bundle.read_bytes() + b"changed during job")
                    changed = True
                return original_probe(*args, **kwargs)
            render_bundle.probe = mutate_after_load
            with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(ValueError, "bundle changed"):
                render(bundle, output, 360)
            self.assertFalse((output / "receipt.json").exists())
            self.assertFalse((output / "source-cut-review.mp4").exists())
        finally:
            render_bundle.probe = original_probe

    def test_validated_segment_changes_before_or_during_mux_are_rejected(self):
        import render_bundle
        original_ffmpeg = render_bundle.ffmpeg
        for phase in ("before muxing", "during muxing"):
            with self.subTest(phase=phase):
                output = self.root / ("changed-segment-" + phase.replace(" ", "-"))
                bundle = self.write_bundle(output.name)
                try:
                    def mutate_segment(args):
                        result = original_ffmpeg(args)
                        trigger = "pcm_f32le" in args if phase == "before muxing" else "concat" in args
                        if trigger:
                            segment = Path(args[-1]).parent / "picture-0001.mp4"
                            segment.write_bytes(segment.read_bytes()[:48])
                        return result
                    render_bundle.ffmpeg = mutate_segment
                    with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(ValueError, "segment changed " + phase):
                        render(bundle, output, 360)
                    diagnostic = json.loads((output / "verification-failure.json").read_text())
                    self.assertEqual(diagnostic["phase"], phase)
                    self.assertEqual(diagnostic["segment"], "picture-0001.mp4")
                    self.assertNotEqual(diagnostic["expected"]["sha256"], diagnostic["actual"]["sha256"])
                    self.assertFalse((output / "receipt.json").exists())
                    self.assertFalse((output / "source-cut-review.mp4").exists())
                    self.assertFalse(any(output.glob(".work-*")))
                finally:
                    render_bundle.ffmpeg = original_ffmpeg


if __name__ == "__main__":
    unittest.main()
