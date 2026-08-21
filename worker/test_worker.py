from __future__ import annotations

from io import BytesIO
import json
import os
from pathlib import Path
import tempfile
import time
import unittest

from forge_worker import WorkerRuntime


class WorkerRuntimeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def runtime(self) -> WorkerRuntime:
        def execute(job: dict, work_dir: Path) -> Path:
            output = work_dir / "proof.mp4"
            output.write_bytes(b"real-artifact-bytes")
            return output

        return WorkerRuntime(self.root, execute_override=execute)

    def test_job_ids_are_idempotent_and_real_results_are_registered(self) -> None:
        runtime = self.runtime()
        request = {
            "kind": "proof-shot",
            "prompt": "Devon proof",
            "idempotencyKey": "proof-v1",
            "options": {},
        }
        first, deduped_first = runtime.create_job(request)
        second, deduped_second = runtime.create_job(request)
        self.assertFalse(deduped_first)
        self.assertTrue(deduped_second)
        self.assertEqual(first["id"], second["id"])

        deadline = time.time() + 2
        job = runtime.get_job(first["id"])
        while job and job["status"] not in {"succeeded", "failed"} and time.time() < deadline:
            time.sleep(0.02)
            job = runtime.get_job(first["id"])
        self.assertEqual(job["status"], "succeeded")
        self.assertTrue(job["result"].startswith("/v1/artifacts/artifact-"))
        metadata, artifact = runtime.artifact(job["artifact"]["id"])
        self.assertEqual(metadata["sha256"], job["artifact"]["sha256"])
        self.assertEqual(artifact.read_bytes(), b"real-artifact-bytes")

    def test_upload_ticket_checks_hash_and_is_one_time(self) -> None:
        runtime = self.runtime()
        payload = b"approved voice reference"
        import hashlib

        digest = hashlib.sha256(payload).hexdigest()
        ticket = runtime.create_upload_ticket(
            {
                "filename": "devon.wav",
                "kind": "voice-reference",
                "mimeType": "audio/wav",
                "maxBytes": len(payload),
                "sha256": digest,
                "consentId": "asset-consent-1",
            }
        )
        asset = runtime.consume_upload(ticket["ticket"], BytesIO(payload), len(payload))
        self.assertEqual(asset["sha256"], digest)
        self.assertEqual(asset["consentId"], "asset-consent-1")
        with self.assertRaisesRegex(ValueError, "already been used"):
            runtime.consume_upload(ticket["ticket"], BytesIO(payload), len(payload))

    def test_upload_rejects_hash_mismatch_without_persisting_asset(self) -> None:
        runtime = self.runtime()
        ticket = runtime.create_upload_ticket(
            {
                "filename": "devon.png",
                "kind": "identity-image",
                "maxBytes": 100,
                "sha256": "0" * 64,
            }
        )
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            runtime.consume_upload(ticket["ticket"], BytesIO(b"wrong"), 5)
        self.assertEqual(list(runtime.paths.asset_meta.glob("*.json")), [])

    def test_unknown_job_kind_is_refused(self) -> None:
        runtime = self.runtime()
        with self.assertRaisesRegex(ValueError, "Unknown job kind"):
            runtime.create_job({"kind": "pretend", "idempotencyKey": "x"})

    def test_prior_artifact_can_feed_a_later_master_job(self) -> None:
        runtime = self.runtime()
        source = self.root / "generated-shot.mp4"
        source.write_bytes(b"generated-shot")
        artifact = runtime.register_artifact(source, kind="proof-shot", job_id="proof-1")

        metadata, resolved = runtime.media(artifact["id"])

        self.assertEqual(metadata["id"], artifact["id"])
        self.assertEqual(resolved.read_bytes(), b"generated-shot")


if __name__ == "__main__":
    unittest.main()
