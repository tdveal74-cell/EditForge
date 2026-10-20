import hashlib
import io
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest


class VelaInstallAssetsTest(unittest.TestCase):
    def run_install(self, members, mode="apply", build_fails=False):
        with tempfile.TemporaryDirectory(prefix="vela-install-test-") as temporary:
            root = Path(temporary)
            dest = root / "vela"
            assets = dest / "production-assets"
            assets.mkdir(parents=True)
            protected = assets / "protected.asset"
            protected.write_bytes(b"original production media\x00\xff")
            original_hash = hashlib.sha256(protected.read_bytes()).hexdigest()
            (dest / "old-app.txt").write_text("previous app")
            pack = root / "vela-src.tgz"
            with tarfile.open(pack, "w:gz") as archive:
                for name, body, kind in members:
                    item = tarfile.TarInfo(name)
                    if kind == "link":
                        item.type = tarfile.SYMTYPE
                        item.linkname = "production-assets"
                        archive.addfile(item)
                    else:
                        content = body.encode()
                        item.size = len(content)
                        archive.addfile(item, io.BytesIO(content))
            binary = root / "bin"
            binary.mkdir()
            for command in ("docker", "curl"):
                script = binary / command
                script.write_text("#!/bin/sh\nif [ \"$1\" = build ] && [ \"$VELA_TEST_BUILD_FAIL\" = 1 ]; then exit 17; fi\nexit 0\n")
                script.chmod(0o755)
            source = (Path(__file__).parent / "vela-install.sh").read_text()
            source = source.replace("dest=/opt/vela", f"dest={dest}")
            source = source.replace("/tmp/vela-src.tgz", str(pack))
            source = source.replace("/tmp/VELA_RUNBOOK.md", str(root / "absent-runbook.md"))
            runner = root / "installer.sh"
            runner.write_text(source)
            result = subprocess.run(["bash", str(runner), mode], capture_output=True, text=True, env={**os.environ, "VELA_TEST_BUILD_FAIL": "1" if build_fails else "0", "PATH": str(binary) + os.pathsep + os.environ["PATH"]})
            self.assertEqual(hashlib.sha256(protected.read_bytes()).hexdigest(), original_hash)
            return result, (dest / "old-app.txt").exists(), (dest / "package.json").exists()

    def test_apply_updates_app_but_preserves_production_assets(self):
        result, old_exists, new_exists = self.run_install([("./package.json", "{}", "file")])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(old_exists)
        self.assertTrue(new_exists)

    def test_failed_build_keeps_previous_application_and_assets(self):
        result, old_exists, new_exists = self.run_install([("package.json", "{}", "file")], build_fails=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(old_exists, "a failed candidate build must preserve the previous application")
        self.assertFalse(new_exists)

    def test_pack_cannot_overwrite_the_asset_directory(self):
        result, old_exists, _ = self.run_install([("./production-assets/protected.asset", "replacement", "file")])
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(old_exists)

    def test_link_or_traversal_is_refused_before_old_app_removal(self):
        for entry in [("alias", "", "link"), ("../outside", "replacement", "file")]:
            with self.subTest(entry=entry):
                result, old_exists, _ = self.run_install([entry])
                self.assertNotEqual(result.returncode, 0)
                self.assertTrue(old_exists)

    def test_dry_run_changes_no_application_files(self):
        result, old_exists, new_exists = self.run_install([("package.json", "{}", "file")], "dry-run")
        self.assertEqual(result.returncode, 0)
        self.assertTrue(old_exists)
        self.assertFalse(new_exists)


if __name__ == "__main__":
    unittest.main()
