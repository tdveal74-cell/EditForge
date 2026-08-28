import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("configure-provider-credentials.py")
SPEC = importlib.util.spec_from_file_location("provider_setup", SCRIPT)
provider_setup = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(provider_setup)


class ProviderSetupTests(unittest.TestCase):
    def test_render_env_replaces_values_without_printing_them_elsewhere(self):
        existing = "# keep\nRUNWAYML_API_SECRET=old\nOTHER=value\nRUNWAYML_API_SECRET=older\n"
        rendered = provider_setup.render_env(
            existing,
            {"RUNWAYML_API_SECRET": "new", "ELEVENLABS_API_KEY": "eleven"},
        )
        self.assertEqual(
            rendered,
            "# keep\nRUNWAYML_API_SECRET=new\nOTHER=value\n\nELEVENLABS_API_KEY=eleven\n",
        )

    def test_atomic_write_sets_private_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            provider_setup.atomic_write(path, "KEY=value\n")
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_reference_configuration_preserves_consent_and_other_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / "reference.png"
            reference.write_bytes(b"png")
            registry_path = root / "registry.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "schema": "editforge.identity-registry.v1",
                        "identities": [
                            {
                                "id": "tee-identity-v1",
                                "consentRecorded": True,
                                "providers": {
                                    "runwayAvatarId": "keep-me",
                                    "runwayCharacterUri": "remove-me",
                                },
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            provider_setup.ensure_reference_configuration(
                registry_path, "tee-identity-v1", reference
            )
            updated = json.loads(registry_path.read_text(encoding="utf-8"))
            identity = updated["identities"][0]
            self.assertTrue(identity["consentRecorded"])
            self.assertEqual(identity["providers"]["runwayAvatarId"], "keep-me")
            self.assertEqual(
                identity["providers"]["runwayCharacterFile"],
                "/run/secrets/tee-runway-clone-reference.png",
            )
            self.assertNotIn("runwayCharacterUri", identity["providers"])
            self.assertEqual(reference.stat().st_mode & 0o777, 0o600)

    def test_voice_selection_updates_only_canonical_voice(self):
        with tempfile.TemporaryDirectory() as directory:
            registry_path = Path(directory) / "registry.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "schema": "editforge.identity-registry.v1",
                        "identities": [
                            {
                                "id": "tee-identity-v1",
                                "providers": {"runwayCharacterType": "image"},
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            provider_setup.store_voice_selection(
                registry_path,
                "tee-identity-v1",
                {"voice_id": "secret-internal-id", "name": "Tee Clone"},
            )
            identity = json.loads(registry_path.read_text())["identities"][0]
            self.assertEqual(identity["providers"]["elevenlabsVoiceId"], "secret-internal-id")
            self.assertEqual(identity["providers"]["runwayCharacterType"], "image")

    def test_exact_voice_id_must_be_available_to_key(self):
        voices = [
            {"voice_id": "tee-voice", "name": "Tee Clone", "category": "cloned"},
            {"voice_id": "another-voice", "name": "Another", "category": "premade"},
        ]
        selected = provider_setup.resolve_voice(voices, "tee-voice")
        self.assertEqual(selected["name"], "Tee Clone")
        with self.assertRaises(provider_setup.SetupError):
            provider_setup.resolve_voice(voices, "missing")

    def test_skip_voice_rejects_exact_voice_id(self):
        with self.assertRaises(SystemExit):
            provider_setup.parse_args(
                ["--skip-voice", "--elevenlabs-voice-id", "tee-voice"]
            )


if __name__ == "__main__":
    unittest.main()
