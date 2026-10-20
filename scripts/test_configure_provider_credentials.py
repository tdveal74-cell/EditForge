import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch
import io
import urllib.error
import urllib.parse
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

    def _registry_with(self, directory: Path) -> Path:
        registry_path = directory / "registry.json"
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
        return registry_path

    def test_voice_selection_updates_only_canonical_voice(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry_path = self._registry_with(root)
            provider_setup.store_voice_selection(
                registry_path,
                "tee-identity-v1",
                {"voice_id": "secret-internal-id", "name": "Tee Clone"},
                root / ".env",
            )
            identity = json.loads(registry_path.read_text())["identities"][0]
            self.assertEqual(identity["providers"]["elevenlabsVoiceId"], "secret-internal-id")
            self.assertEqual(identity["providers"]["runwayCharacterType"], "image")

    def test_voice_selection_also_binds_the_studio_voice_path(self):
        # The registry entry only reaches the DEVON adapter. Without this the
        # studio's own /voice page refuses for a missing ELEVENLABS_VOICE_ID
        # while the setup reports the voice configured.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            env_path = root / ".env"
            env_path.write_text("ELEVENLABS_API_KEY=key\n", encoding="utf-8")
            provider_setup.store_voice_selection(
                self._registry_with(root),
                "tee-identity-v1",
                {"voice_id": "secret-internal-id", "name": "Tee Clone"},
                env_path,
            )
            env = provider_setup.read_env(env_path)
            self.assertEqual(env["ELEVENLABS_VOICE_ID"], "secret-internal-id")
            self.assertEqual(env["ELEVENLABS_API_KEY"], "key")
            self.assertEqual(env_path.stat().st_mode & 0o777, 0o600)

    def test_studio_voice_accepts_a_per_voice_pin(self):
        # Mirrors lib/provider-registry.ts, which is satisfied by either name.
        self.assertTrue(
            provider_setup.studio_voice_configured({"ELEVENLABS_VOICE_ID": "default"})
        )
        self.assertTrue(
            provider_setup.studio_voice_configured({"ELEVENLABS_VOICE_ID_AUREN": "pinned"})
        )
        self.assertFalse(provider_setup.studio_voice_configured({"ELEVENLABS_API_KEY": "key"}))
        self.assertFalse(provider_setup.studio_voice_configured({"ELEVENLABS_VOICE_ID": "  "}))

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

    def test_skip_avatar_rejects_exact_heygen_ids(self):
        for flag in ("--heygen-avatar-id", "--heygen-voice-id"):
            with self.assertRaises(SystemExit):
                provider_setup.parse_args(["--skip-avatar", flag, "some-id"])

    def test_v3_looks_paginate_and_use_look_not_group_id(self):
        calls = []
        def read(request, timeout):
            calls.append(request)
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(request.full_url).query)
            self.assertEqual(urllib.parse.urlsplit(request.full_url).path, "/v3/avatars/looks")
            self.assertEqual(request.get_header("X-api-key"), "fixture-key")
            self.assertNotIn("Authorization", request.headers)
            page = {"data": [{"id": "look-2", "group_id": "group-1", "name": "Suit"}], "has_more": False} if query.get("token") else {"data": [{"id": "look-1", "name": "Casual"}], "has_more": True, "next_token": "a+b /"}
            return io.StringIO(json.dumps(page))
        with patch.object(provider_setup.urllib.request, "urlopen", side_effect=read):
            result = provider_setup.fetch_heygen_avatars("fixture-key")
        self.assertEqual([v["avatar_id"] for v in result], ["look-1", "look-2"])
        self.assertEqual(len(calls), 2)
        self.assertEqual(urllib.parse.parse_qs(urllib.parse.urlsplit(calls[1].full_url).query)["token"], ["a+b /"])

    def test_v3_voices_include_private_clones_without_default_selection(self):
        def read(request, timeout):
            parts = urllib.parse.urlsplit(request.full_url)
            self.assertEqual(parts.path, "/v3/voices")
            kind = urllib.parse.parse_qs(parts.query)["type"][0]
            return io.StringIO(json.dumps({"data": [{"voice_id": kind, "name": kind}], "has_more": False}))
        with patch.object(provider_setup.urllib.request, "urlopen", side_effect=read):
            voices = provider_setup.fetch_heygen_voices("fixture-key")
        self.assertEqual([v["voice_id"] for v in voices], ["public", "private"])
        self.assertEqual(provider_setup.resolve_heygen_voice(voices, "private")["voice_id"], "private")

    def test_v3_catalog_refuses_incomplete_or_looping_pagination(self):
        for payload in [{"data": [], "has_more": True}, {"data": [], "has_more": True, "next_token": "same"}, {"data": {}}, {"data": [None]}]:
            with self.subTest(payload=payload), patch.object(provider_setup.urllib.request, "urlopen", side_effect=lambda *a, **kw: io.StringIO(json.dumps(payload))):
                with self.assertRaises(provider_setup.SetupError):
                    provider_setup.fetch_heygen_avatars("fixture-key")

    def test_catalog_auth_and_rate_errors_are_safe_and_never_retried(self):
        for code in [401, 403, 429, 500]:
            with self.subTest(code=code), patch.object(provider_setup.urllib.request, "urlopen", side_effect=urllib.error.HTTPError("https://api.heygen.com/v3/voices", code, "fixture-key", {}, None)) as transport:
                with self.assertRaises(provider_setup.SetupError) as error:
                    provider_setup.fetch_heygen_voices("fixture-key")
                self.assertNotIn("fixture-key", str(error.exception))
                self.assertEqual(transport.call_count, 1)

    def test_exact_heygen_avatar_must_be_available_to_key(self):
        avatars = [
            {"avatar_id": "tee-look", "name": "Tee", "gender": "unknown"},
            {"avatar_id": "other", "name": "Other", "gender": "unknown"},
        ]
        self.assertEqual(provider_setup.resolve_heygen_avatar(avatars, "tee-look")["name"], "Tee")
        with self.assertRaises(provider_setup.SetupError):
            provider_setup.resolve_heygen_avatar(avatars, "missing")
        with self.assertRaises(provider_setup.SetupError):
            provider_setup.resolve_heygen_avatar([], "tee-look")

    def test_exact_heygen_voice_must_be_available_to_key(self):
        voices = [{"voice_id": "vo-1", "name": "Narrator", "language": "en"}]
        self.assertEqual(provider_setup.resolve_heygen_voice(voices, "vo-1")["name"], "Narrator")
        with self.assertRaises(provider_setup.SetupError):
            provider_setup.resolve_heygen_voice(voices, "missing")
        with self.assertRaises(provider_setup.SetupError):
            provider_setup.resolve_heygen_voice([], None)

    def test_configure_avatar_writes_both_ids_the_wire_requires(self):
        with tempfile.TemporaryDirectory() as directory:
            env_path = Path(directory) / ".env"
            args = provider_setup.parse_args(
                [
                    "--env", str(env_path),
                    "--heygen-avatar-id", "tee-look",
                    "--heygen-voice-id", "vo-1",
                ]
            )
            self._stub_heygen(
                avatars=[{"avatar_id": "tee-look", "name": "Tee", "gender": "unknown"}],
                voices=[{"voice_id": "vo-1", "name": "Narrator", "language": "en"}],
            )
            provider_setup.configure_avatar(args, "heygen-key")
            env = provider_setup.read_env(env_path)
            self.assertEqual(env["HEYGEN_AVATAR_ID"], "tee-look")
            self.assertEqual(env["HEYGEN_VOICE_ID"], "vo-1")

    def test_failed_voice_catalog_preserves_existing_bindings(self):
        with tempfile.TemporaryDirectory() as directory:
            env_path = Path(directory) / ".env"
            original = "HEYGEN_AVATAR_ID=approved-look\nHEYGEN_VOICE_ID=approved-voice\n"
            env_path.write_text(original)
            args = provider_setup.parse_args(["--env", str(env_path), "--heygen-avatar-id", "new-look"])
            with patch.object(provider_setup, "fetch_heygen_avatars", return_value=[{"avatar_id": "new-look", "name": "New"}]), patch.object(provider_setup, "fetch_heygen_voices", side_effect=provider_setup.SetupError("catalog unavailable")):
                with self.assertRaises(provider_setup.SetupError):
                    provider_setup.configure_avatar(args, "fixture-key")
            self.assertEqual(env_path.read_text(), original)

    def _stub_heygen(self, avatars, voices):
        original_avatars = provider_setup.fetch_heygen_avatars
        original_voices = provider_setup.fetch_heygen_voices
        provider_setup.fetch_heygen_avatars = lambda _key: avatars
        provider_setup.fetch_heygen_voices = lambda _key: voices
        self.addCleanup(setattr, provider_setup, "fetch_heygen_avatars", original_avatars)
        self.addCleanup(setattr, provider_setup, "fetch_heygen_voices", original_voices)


if __name__ == "__main__":
    unittest.main()
