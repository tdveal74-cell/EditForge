#!/usr/bin/env python3
"""Securely configure EditForge's Runway, ElevenLabs and HeyGen credentials.

Secrets are collected with hidden prompts, written atomically with mode 0600,
and never printed. The selectors display names only; the ids they resolve are
not credentials and are written where each boundary actually reads them.

Two boundaries read the ElevenLabs voice, and both have to be told. The DEVON
adapter reads `elevenlabsVoiceId` from the private identity registry, while the
studio's own /voice path reads `ELEVENLABS_VOICE_ID` from the environment.
Writing only the registry left a self-host that reported a clean setup and
still refused every voice run for a missing voice id.
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
from typing import Any, Callable


DEFAULT_ENV = Path("/opt/editforge/app/.env")
DEFAULT_REGISTRY = Path("/opt/editforge/secrets/editforge-identities.json")
DEFAULT_REFERENCE = Path("/opt/editforge/secrets/tee-runway-clone-reference.png")
DEFAULT_IDENTITY = "tee-identity-v1"
CONTAINER_REFERENCE = "/run/secrets/tee-runway-clone-reference.png"
ELEVENLABS_VOICES_URL = "https://api.elevenlabs.io/v2/voices"
HEYGEN_AVATARS_URL = "https://api.heygen.com/v2/avatars"
HEYGEN_VOICES_URL = "https://api.heygen.com/v2/voices"
STUDIO_VOICE_KEY = "ELEVENLABS_VOICE_ID"
STUDIO_VOICE_PREFIX = "ELEVENLABS_VOICE_ID_"


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


def choose_option(
    options: list[dict[str, str]],
    heading: str,
    prompt: str,
    label: Callable[[dict[str, str]], str],
) -> dict[str, str]:
    """Numbered menu over names only — the ids behind them are never printed.

    One implementation for every provider's picker. A second copy would be free
    to drift into printing an id, which is the one thing these menus must not do.
    """
    print(f"\n{heading}")
    for index, option in enumerate(options, start=1):
        print(f"  {index}. {label(option)}")
    while True:
        choice = input(prompt).strip()
        if choice.isdigit() and 1 <= int(choice) <= len(options):
            return options[int(choice) - 1]
        print(f"Enter a number from 1 to {len(options)}.")


def select_voice(voices: list[dict[str, str]]) -> dict[str, str]:
    if not voices:
        raise SetupError("No personal or workspace ElevenLabs voices were returned")
    return choose_option(
        voices,
        "Available ElevenLabs voices (IDs remain hidden):",
        "Select Tee's canonical voice by number: ",
        lambda voice: f"{voice['name']} ({voice['category']})",
    )


def find_voice_by_id(voices: list[dict[str, str]], voice_id: str) -> dict[str, str]:
    voice = next((item for item in voices if item["voice_id"] == voice_id), None)
    if voice is None:
        raise SetupError("The requested ElevenLabs voice ID is not available to this API key")
    return voice


def resolve_voice(voices: list[dict[str, str]], voice_id: str | None) -> dict[str, str]:
    return find_voice_by_id(voices, voice_id) if voice_id else select_voice(voices)


def store_voice_selection(
    registry_path: Path,
    identity_id: str,
    voice: dict[str, str],
    env_path: Path,
) -> None:
    """Bind the chosen voice to both boundaries that read it.

    `provider/server.mjs` reads `elevenlabsVoiceId` off the identity registry;
    `lib/provider-registry.ts` reads `ELEVENLABS_VOICE_ID` off the environment.
    They are separate paths, so binding one and not the other produced a studio
    whose /voice page refused with `settingsMissing: ["ELEVENLABS_VOICE_ID"]`
    while this script reported the voice configured. Writing both here — rather
    than at each call site — is what keeps them from drifting apart again.

    The voice id is not an API credential, but it lands in the same 0600 file
    as the keys, so it is never printed either.
    """
    registry = load_registry(registry_path)
    identity = find_identity(registry, identity_id)
    identity.setdefault("providers", {})["elevenlabsVoiceId"] = voice["voice_id"]
    save_registry(registry_path, registry)
    update_env(env_path, {STUDIO_VOICE_KEY: voice["voice_id"]})


def studio_voice_configured(env: dict[str, str]) -> bool:
    """Mirror the studio's own rule for whether a voice id is set.

    `lib/provider-registry.ts` is satisfied by `ELEVENLABS_VOICE_ID` or by any
    `ELEVENLABS_VOICE_ID_<SLUG>` pin. Demanding the default here would call a
    studio unconfigured that would in fact run.
    """
    if _secret_is_configured(env.get(STUDIO_VOICE_KEY)):
        return True
    return any(
        key.startswith(STUDIO_VOICE_PREFIX) and _secret_is_configured(value)
        for key, value in env.items()
    )


def fetch_heygen(url: str, api_key: str, what: str) -> dict[str, Any]:
    """One HeyGen GET. The key travels in `X-Api-Key`; a bearer gets a 401.

    That header choice is not incidental — `lib/provider-registry.ts` sets the
    same one for the render path, and sending the wrong one fails in a way that
    reads exactly like a bad key.
    """
    request = urllib.request.Request(
        url, headers={"Accept": "application/json", "X-Api-Key": api_key}
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            raise SetupError("HeyGen rejected the API key or its permissions") from error
        raise SetupError(f"HeyGen {what} lookup failed with HTTP {error.code}") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise SetupError(f"HeyGen {what} lookup failed: {error}") from error
    return payload if isinstance(payload, dict) else {}


def _heygen_data(payload: dict[str, Any], key: str) -> list[dict[str, Any]]:
    """HeyGen wraps every list in `data`; reading the root finds nothing."""
    data = payload.get("data")
    entries = data.get(key) if isinstance(data, dict) else None
    return [entry for entry in entries or [] if isinstance(entry, dict)]


def fetch_heygen_avatars(api_key: str) -> list[dict[str, str]]:
    """The avatar looks this key can render.

    Only `avatars` — HeyGen also returns `talking_photos`, but the wire submits
    `type: "avatar"` with an `avatar_id`, so offering a talking-photo id would
    build a body the boundary does not implement.
    """
    avatars: list[dict[str, str]] = []
    for avatar in _heygen_data(fetch_heygen(HEYGEN_AVATARS_URL, api_key, "avatar"), "avatars"):
        avatar_id = str(avatar.get("avatar_id") or "").strip()
        if avatar_id:
            avatars.append(
                {
                    "avatar_id": avatar_id,
                    "name": str(avatar.get("avatar_name") or "Unnamed avatar").strip(),
                    "gender": str(avatar.get("gender") or "unknown"),
                }
            )
    return avatars


def fetch_heygen_voices(api_key: str) -> list[dict[str, str]]:
    voices: list[dict[str, str]] = []
    for voice in _heygen_data(fetch_heygen(HEYGEN_VOICES_URL, api_key, "voice"), "voices"):
        voice_id = str(voice.get("voice_id") or "").strip()
        if voice_id:
            voices.append(
                {
                    "voice_id": voice_id,
                    "name": str(voice.get("name") or "Unnamed voice").strip(),
                    "language": str(voice.get("language") or "unknown"),
                }
            )
    return voices


def resolve_heygen_avatar(
    avatars: list[dict[str, str]], avatar_id: str | None
) -> dict[str, str]:
    if not avatars:
        raise SetupError("No HeyGen avatars were returned for this API key")
    if avatar_id:
        avatar = next((item for item in avatars if item["avatar_id"] == avatar_id), None)
        if avatar is None:
            raise SetupError("The requested HeyGen avatar ID is not available to this API key")
        return avatar
    return choose_option(
        avatars,
        "Available HeyGen avatars (IDs remain hidden):",
        "Select the avatar look by number: ",
        lambda avatar: f"{avatar['name']} ({avatar['gender']})",
    )


def resolve_heygen_voice(voices: list[dict[str, str]], voice_id: str | None) -> dict[str, str]:
    if not voices:
        raise SetupError("No HeyGen voices were returned for this API key")
    if voice_id:
        voice = next((item for item in voices if item["voice_id"] == voice_id), None)
        if voice is None:
            raise SetupError("The requested HeyGen voice ID is not available to this API key")
        return voice
    return choose_option(
        voices,
        "Available HeyGen voices (IDs remain hidden):",
        "Select the avatar voice by number: ",
        lambda voice: f"{voice['name']} ({voice['language']})",
    )


def configure_avatar(args: argparse.Namespace, api_key: str) -> None:
    """Resolve and bind both ids the HeyGen wire requires.

    The wire refuses without either one, and a render refused for a missing look
    id reads as a credential problem until something says otherwise. Both are
    written together so the studio never sees half an avatar configured.
    """
    avatar = resolve_heygen_avatar(fetch_heygen_avatars(api_key), args.heygen_avatar_id)
    voice = resolve_heygen_voice(fetch_heygen_voices(api_key), args.heygen_voice_id)
    update_env(
        args.env,
        {"HEYGEN_AVATAR_ID": avatar["avatar_id"], "HEYGEN_VOICE_ID": voice["voice_id"]},
    )
    print(f"HeyGen avatar selected: {avatar['name']} speaking as {voice['name']} (IDs hidden).")


def configure(args: argparse.Namespace) -> None:
    runway_key = getpass.getpass("Runway API secret (hidden): ").strip()
    elevenlabs_key = getpass.getpass("ElevenLabs API key (hidden): ").strip()
    if not runway_key or not elevenlabs_key:
        raise SetupError("Both provider keys are required; no changes were written")
    # HeyGen stays optional: a studio that renders no talking head should not be
    # made to hold a key for one. A blank answer skips the avatar path entirely
    # rather than writing an empty key that would fail at render time.
    heygen_key = (
        ""
        if args.skip_avatar
        else getpass.getpass("HeyGen API key (hidden, blank to skip avatar): ").strip()
    )

    ensure_reference_configuration(args.registry, args.identity, args.reference)
    updates = {
        "RUNWAYML_API_SECRET": runway_key,
        "ELEVENLABS_API_KEY": elevenlabs_key,
        "EDITFORGE_RUNWAY_CHARACTER_FILE": str(args.reference),
    }
    if heygen_key:
        updates["HEYGEN_API_KEY"] = heygen_key
    update_env(args.env, updates)
    print("Provider credentials saved securely (values hidden).")

    configure_voice(args, elevenlabs_key)
    if heygen_key:
        configure_avatar(args, heygen_key)


def configure_voice(args: argparse.Namespace, elevenlabs_key: str) -> None:
    if args.skip_voice:
        return
    if args.elevenlabs_voice_id:
        voice = resolve_voice(fetch_elevenlabs_voices(elevenlabs_key), args.elevenlabs_voice_id)
        store_voice_selection(args.registry, args.identity, voice, args.env)
        print(f"Canonical ElevenLabs voice selected: {voice['name']} (ID validated).")
        return
    answer = input("Select the canonical ElevenLabs voice now? [Y/n]: ").strip().lower()
    if answer not in ("", "y", "yes"):
        print("Voice selection skipped. Re-run with --select-elevenlabs-voice.")
        return
    voice = resolve_voice(fetch_elevenlabs_voices(elevenlabs_key), None)
    store_voice_selection(args.registry, args.identity, voice, args.env)
    print(f"Canonical ElevenLabs voice selected: {voice['name']} (ID hidden).")


def select_existing_voice(args: argparse.Namespace) -> None:
    key = read_env(args.env).get("ELEVENLABS_API_KEY")
    if not _secret_is_configured(key):
        raise SetupError("ELEVENLABS_API_KEY is not configured; run without a mode first")
    voice = resolve_voice(fetch_elevenlabs_voices(key or ""), args.elevenlabs_voice_id)
    store_voice_selection(args.registry, args.identity, voice, args.env)
    print(f"Canonical ElevenLabs voice selected: {voice['name']} (ID hidden).")


def select_existing_avatar(args: argparse.Namespace) -> None:
    key = read_env(args.env).get("HEYGEN_API_KEY")
    if not _secret_is_configured(key):
        raise SetupError("HEYGEN_API_KEY is not configured; run without a mode first")
    configure_avatar(args, key or "")


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
        # The registry entry above serves the DEVON adapter only. This is the
        # one the studio's own /voice path reads, and a self-host configured
        # before this script wrote it will report false here until it re-runs
        # --select-elevenlabs-voice.
        "studioVoiceConfigured": studio_voice_configured(env),
    }
    # HeyGen is optional, so its absence is not a failure — but a key with no
    # avatar or voice behind it is, because every render would refuse. Report
    # the three either way so a half-wired avatar is visible rather than silent.
    heygen_key_configured = _secret_is_configured(env.get("HEYGEN_API_KEY"))
    heygen = {
        "heygenKeyConfigured": heygen_key_configured,
        "heygenAvatarConfigured": _secret_is_configured(env.get("HEYGEN_AVATAR_ID")),
        "heygenVoiceConfigured": _secret_is_configured(env.get("HEYGEN_VOICE_ID")),
    }
    print(json.dumps({**results, **heygen}, indent=2))
    if heygen_key_configured and not (
        heygen["heygenAvatarConfigured"] and heygen["heygenVoiceConfigured"]
    ):
        return False
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
    mode.add_argument(
        "--select-heygen-avatar",
        action="store_true",
        help="select the avatar look and voice using the already stored HeyGen key",
    )
    parser.add_argument("--skip-voice", action="store_true", help="store keys without selecting a voice")
    parser.add_argument(
        "--elevenlabs-voice-id",
        help="validate and bind an exact ElevenLabs voice ID (the ID is not an API credential)",
    )
    parser.add_argument(
        "--skip-avatar", action="store_true", help="do not prompt for a HeyGen key at all"
    )
    parser.add_argument(
        "--heygen-avatar-id",
        help="validate and bind an exact HeyGen avatar ID (the ID is not an API credential)",
    )
    parser.add_argument(
        "--heygen-voice-id",
        help="validate and bind an exact HeyGen voice ID (the ID is not an API credential)",
    )
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--reference", type=Path, default=DEFAULT_REFERENCE)
    parser.add_argument("--identity", default=DEFAULT_IDENTITY)
    args = parser.parse_args(argv)
    if args.skip_voice and args.elevenlabs_voice_id:
        parser.error("--skip-voice cannot be combined with --elevenlabs-voice-id")
    if args.skip_avatar and (args.heygen_avatar_id or args.heygen_voice_id):
        parser.error("--skip-avatar cannot be combined with --heygen-avatar-id or --heygen-voice-id")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        if args.check:
            return 0 if check(args) else 1
        if args.select_elevenlabs_voice:
            select_existing_voice(args)
        elif args.select_heygen_avatar:
            select_existing_avatar(args)
        else:
            configure(args)
        return 0
    except (SetupError, OSError) as error:
        print(f"Setup failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
