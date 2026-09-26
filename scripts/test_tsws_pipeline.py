"""Meaningful gate and end-to-end picture-proof checks using synthetic plates."""

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("tsws_pipeline", ROOT / "scripts" / "tsws_pipeline.py")
pipeline = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pipeline)


class TSWSPipelineTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.work = self.root / "work"
        (self.work / "media").mkdir(parents=True)
        (self.work / "qc").mkdir()
        self.plan = json.loads((ROOT / "tsws" / "episode-s01e01.json").read_text())
        self.plan["width"], self.plan["height"] = 320, 180
        self.plan["proofFrames"] = 48
        self.plan["shots"][0]["outFrame"] = 24
        self.plan["shots"][1]["inFrame"] = 24
        self.plan["shots"][1]["outFrame"] = 48
        self.manifest = self.root / "plan.json"
        self.manifest.write_text(json.dumps(self.plan))

    def make_plate(self, shot, color):
        target = self.work / "media" / f"{shot['id']}.mp4"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                        "-f", "lavfi", "-i", f"color=c={color}:s=320x180:r=24:d=1",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", str(target)], check=True)
        receipt = {"schema": "tsws.shot-qc.v1", "shotId": shot["id"],
                   "file": f"media/{shot['id']}.mp4", "sha256": pipeline.sha256(target),
                   "reviewer": "Test director", "reviewedAt": "2026-09-26T18:00:00Z",
                   "decision": "pass", "checks": dict.fromkeys(pipeline.CHECKS, True)}
        (self.work / "qc" / f"{shot['id']}.json").write_text(json.dumps(receipt))
        return target

    def test_rejects_gaps_and_silence_drift(self):
        self.plan["shots"][1]["inFrame"] = 25
        with self.assertRaisesRegex(pipeline.GateError, "gap or overlap"):
            pipeline.validate(self.plan)
        self.plan["shots"][1]["inFrame"] = 24
        self.plan["canon"]["protectedSilenceFrames"] = 95
        with self.assertRaisesRegex(pipeline.GateError, "four-second silence"):
            pipeline.validate(self.plan)

    def test_receipt_gates_and_actual_two_second_assembly(self):
        shots = pipeline.validate(self.plan)
        first = self.make_plate(shots[0], "black")
        self.make_plate(shots[1], "blue")
        self.assertEqual([pipeline.check_shot(self.plan, self.work, shot) for shot in shots][0], first)
        first.write_bytes(first.read_bytes() + b"altered")
        with self.assertRaisesRegex(pipeline.GateError, "SHA-256"):
            pipeline.check_shot(self.plan, self.work, shots[0])
        self.make_plate(shots[0], "black")
        output = self.root / "proof.mp4"
        subprocess.run(["python3", str(ROOT / "scripts" / "tsws_pipeline.py"),
                        "assemble", str(self.manifest), str(self.work), str(output)], check=True)
        width, height, duration, _ = pipeline.probe(output)
        self.assertEqual((width, height), (320, 180))
        self.assertAlmostEqual(duration, 2.0, places=2)


if __name__ == "__main__":
    unittest.main()
