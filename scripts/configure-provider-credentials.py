#!/usr/bin/env python3
"""Securely configure EditForge's Runway and ElevenLabs credentials.

Secrets are collected with hidden prompts, written atomically with mode 0600,
and never printed. The optional voice selector displays names only and stores
the selected ElevenLabs voice ID in the private identity registry.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import stat
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


DEFAULT_ENV = Path("/opt/editforge/app/.env")
DEFAULT_REGISTRY = Path("/opt/editforge/secrets/editforge-identities.json")
DEFAULT_REFERENCE = Path("/opt/editforge/secrets/tee-runway-clone-reference.png")
DEFAULT_IDENTITY = "tee-identity-v1"
CONTAINER_REFERENCE = "/run/secrets/tee-runway-clone-reference.png"
ELEVENLABS_VOICES_URL = "https://api.elevenlabs.io/v2/voices"


class SetupError(RuntimeError):
    """A safe, user-facing setup failure."""


def _secret_is_configured(value: str | None) -> bool:
    normalized = (value or "").strip()
    return bool(normalized and not normalized.lower().startswith("replace-with"))


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def render_env(existing: str, updates: dict[str, str]) -> str:
    pending = dict(updates)
    written: set[str] = set()
    rendered: list[str] = []
    for raw_line in existing.splitlines():
        stripped = raw_line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in updates:
                if key not in written:
                    rendered.append(f"{key}={updates[key]}")
                    written.add(key)
                    pending.pop(key, None)
                continue
        rendered.append(raw_line)
    if pending and rendered and rendered[-1] != "":
        rendered.append("")
    rendered.extend(f"{key}={value}" for key, value in pending.items())
    return "\n".join(rendered).rstrip("\n") + "\n"


def atomic_write(path: Path, content: str, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, mode)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        os.chmod(path, mode)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def update_env(path: Path, updates: dict[str, str]) -> None:
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    atomic_write(path, render_env(existing, updates))


def load_registry(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise SetupError(f"Identity registry not found: {path}")
    try:
        registry = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SetupError(f"Identity registry is unreadable: {error}") from error
    if registry.get("schema") != "editforge.identity-registry.v1":
        raise SetupError("Identity registry schema is not editforge.identity-registry.v1")
    if not isinstance(registry.get("identities"), list):
        raise SetupError("Identity registry has no identities list")
    return registry


def find_identity(registry: dict[str, Any], identity_id: str) -> dict[str, Any]:
    identity = next(
        (item for item in registry["identities"] if item.get("id") == identity_id),
        None,
    )
    if identity is None:
        raise SetupError(f"Identity not found: {identity_id}")
    return identity


def save_registry(path: Path, registry: dict[str, Any]) -> None:
    atomic_write(path, json.dumps(registry, indent=2) + "\n")


def ensure_reference_configuration(
    registry_path: Path,
    identity_id: str,
    host_reference: Path,
) -> None:
    if not host_reference.is_file():
        raise SetupError(f"Runway reference image not found: {host_reference}")
    registry = load_registry(registry_path)
    identity = find_identity(registry, identity_id)
    providers = identity.setdefault("providers", {})
    providers["runwayCharacterFile"] = CONTAINER_REFERENCE
    providers["runwayCharacterType"] = "image"
    providers.pop("runwayCharacterUri", None)
    save_registry(registry_path, registry)
    os.chmod(host_reference, 0o600)


def fetch_elevenlabs_voices(api_key: str) -> list[dict[str, str]]:
    voices: list[dict[str, str]] = []
    page_token: str | None = None
    while True:
        query = {
            "page_size": "100",
            "sort": "name",
            "sort_direction": "asc",
            "voice_type": "non-community",
        }
        if page_token:
            query["next_page_token"] = page_token
        request = urllib.request.Request(
            f"{ELEVENLABS_VOICES_URL}?{urllib.parse.urlencode(query)}",
            headers={"Accept": "application/json", "xi-api-key": api_key},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.load(response)
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                raise SetupError("ElevenLabs rejected the API key or its permissions") from error
            raise SetupError(f"ElevenLabs voice lookup failed with HTTP {error.code}") from error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise SetupError(f"ElevenLabs voice lookup failed: {error}") from error

        for voice in payload.get("voices", []):
            voice_id = str(voice.get("voice_id") or "").strip()
            name = str(voice.get("name") or "Unnamed voice").strip()
            if voice_id:
                voices.append(
                    {
                        "voice_id": voice_id,
                        "name": name,
                        "category": str(voice.get("category") or "unknown"),
                    }
                )
        if not payload.get("has_more"):
            break
        page_token = payload.get("next_page_token")
        if not page_token:
            break
    return voices


def select_voice(voices: list[dict[str, str]]) -> dict[str, str]:
    if not voices:
        raise SetupError("No personal or workspace ElevenLabs voices were returned")
    print("\nAvailable ElevenLabs voices (IDs remain hidden):")
    for index, voice in enumerate(voices, start=1):
        print(f"  {index}. {voice['name']} ({voice['category']})")
    while True:
        choice = input("Select Tee's canonical voice by number: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(voices):
            return voices[int(choice) - 1]
        print(f"Enter a number from 1 to {len(voices)}.")


def find_voice_by_id(voices: list[dict[str, str]], voice_id: str) -> dict[str, str]:
    voice = next((item for item in voices if item["voice_id"] == voice_id), None)
    if voice is None:
        raise SetupError("The requested ElevenLabs voice ID is not available to this API key")
    return voice


def resolve_voice(voices: list[dict[str, str]], voice_id: str | None) -> dict[str, str]:
    return find_voice_by_id(voices, voice_id) if voice_id else select_voice(voices)


def store_voice_selection(registry_path: Path, identity_id: str, voice: dict[str, str]) -> None:
    registry = load_registry(registry_path)
    identity = find_identity(registry, identity_id)
    identity.setdefault("providers", {})["elevenlabsVoiceId"] = voice["voice_id"]
    save_registry(registry_path, registry)


def configure(args: argparse.Namespace) -> None:
    runway_key = getpass.getpass("Runway API secret (hidden): ").strip()
    elevenlabs_key = getpass.getpass("ElevenLabs API key (hidden): ").strip()
    if not runway_key or not elevenlabs_key:
        raise SetupError("Both provider keys are required; no changes were written")

    ensure_reference_configuration(args.registry, args.identity, args.reference)
    update_env(
        args.env,
        {
            "RUNWAYML_API_SECRET": runway_key,
            "ELEVENLABS_API_KEY": elevenlabs_key,
            "EDITFORGE_RUNWAY_CHARACTER_FILE": str(args.reference),
        },
    )
    print("Provider credentials saved securely (values hidden).")

    if args.skip_voice:
        return
    if args.elevenlabs_voice_id:
        voice = resolve_voice(fetch_elevenlabs_voices(elevenlabs_key), args.elevenlabs_voice_id)
        store_voice_selection(args.registry, args.identity, voice)
        print(f"Canonical ElevenLabs voice selected: {voice['name']} (ID validated).")
        return
    answer = input("Select the canonical ElevenLabs voice now? [Y/n]: ").strip().lower()
    if answer not in ("", "y", "yes"):
        print("Voice selection skipped. Re-run with --select-elevenlabs-voice.")
        return
    voices = fetch_elevenlabs_voices(elevenlabs_key)
    voice = resolve_voice(voices, None)
    store_voice_selection(args.registry, args.identity, voice)
    print(f"Canonical ElevenLabs voice selected: {voice['name']} (ID hidden).")


def select_existing_voice(args: argparse.Namespace) -> None:
    key = read_env(args.env).get("ELEVENLABS_API_KEY")
    if not _secret_is_configured(key):
        raise SetupError("ELEVENLABS_API_KEY is not configured; run without a mode first")
    voice = resolve_voice(fetch_elevenlabs_voices(key or ""), args.elevenlabs_voice_id)
    store_voice_selection(args.registry, args.identity, voice)
    print(f"Canonical ElevenLabs voice selected: {voice['name']} (ID hidden).")


def check(args: argparse.Namespace) -> bool:
    env = read_env(args.env)
    registry: dict[str, Any] | None = None
    identity: dict[str, Any] | None = None
    try:
        registry = load_registry(args.registry)
        identity = find_identity(registry, args.identity)
    except SetupError:
        pass
    providers = identity.get("providers", {}) if identity else {}
    reference_mode = None
    if args.reference.exists():
        reference_mode = stat.S_IMODE(args.reference.stat().st_mode)
    results = {
        "envFile": args.env.is_file(),
        "runwayKeyConfigured": _secret_is_configured(env.get("RUNWAYML_API_SECRET")),
        "elevenlabsKeyConfigured": _secret_is_configured(env.get("ELEVENLABS_API_KEY")),
        "identityRegistry": registry is not None,
        "consentRecorded": bool(identity and identity.get("consentRecorded") is True),
        "runwayReference": args.reference.is_file(),
        "runwayReferencePrivate": reference_mode == 0o600,
        "runwayReferenceConfigured": (
            providers.get("runwayCharacterFile") == CONTAINER_REFERENCE
            and providers.get("runwayCharacterType") == "image"
        ),
        "elevenlabsVoiceConfigured": _secret_is_configured(providers.get("elevenlabsVoiceId")),
    }
    print(json.dumps(results, indent=2))
    return all(results.values())


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="print configuration booleans only")
    mode.add_argument(
        "--select-elevenlabs-voice",
        action="store_true",
        help="select a voice using the already stored API key",
    )
    parser.add_argument("--skip-voice", action="store_true", help="store keys without selecting a voice")
    parser.add_argument(
        "--elevenlabs-voice-id",
        help="validate and bind an exact ElevenLabs voice ID (the ID is not an API credential)",
    )
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--reference", type=Path, default=DEFAULT_REFERENCE)
    parser.add_argument("--identity", default=DEFAULT_IDENTITY)
    args = parser.parse_args(argv)
    if args.skip_voice and args.elevenlabs_voice_id:
        parser.error("--skip-voice cannot be combined with --elevenlabs-voice-id")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        if args.check:
            return 0 if check(args) else 1
        if args.select_elevenlabs_voice:
            select_existing_voice(args)
        else:
            configure(args)
        return 0
    except (SetupError, OSError) as error:
        print(f"Setup failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
