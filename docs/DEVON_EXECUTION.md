# DEVON-controlled media execution

**Updated:** 2026-08-26

DEVON is the sole orchestration and approval authority. EditForge is the media
execution engine. The boundary is non-destructive: it can create a new revision,
preview, or master, but it cannot publish, delete, change canon, or change the
approved clone/voice identity.

## What the stack renders

| Deliverable | Typical output | Required path |
|---|---|---|
| Long form | 16:9 MP4 preview or ProRes MOV master | assembly, grade, mix, captions, master gate |
| Short form | 9:16 or 1:1 MP4 | derive/reframe, captions, mix, platform-safe encode |
| Micro-drama | 9:16 episodic MP4 | locked canon, full-motion generation, clone voice, lip sync, assembly |

Locally compiled operations are `trim`, `reframe`, `derive-short`, `speed`,
`captions`, `audio-mix`, `grade`, and preview/master encoding. Nonlinear timeline
operations (`split`, `reorder`, `replace-shot`, `title`, `transition`, episode and
compilation assembly) use `EDITFORGE_TIMELINE_ADAPTER_URL`. Clone voice, full motion,
and lip sync use the voice, motion, and lip-sync adapter URLs. Self-hosted defaults
point those URLs at the private built-in provider service. An accepted operation
without a compiler or adapter fails; it is never silently skipped.

## Authority and lifecycle

1. DEVON validates the edit intent and requests approval through its shared approval queue.
2. Approval binds to the SHA-256 of the exact intent.
3. DEVON adds operation-level scopes and submits `editforge.edit-command.v1`.
4. EditForge validates, records, deduplicates, and dispatches the immutable revision.
5. The worker verifies the source hash, executes adapters and FFmpeg, probes the output,
   stores the artifact, and returns `editforge.edit-receipt.v1`.
6. DEVON validates the command id, revision id, terminal state, artifact URI, and hash.

The API surface is deliberately small:

| Route | Authority |
|---|---|
| `POST /api/edits` | Accept an approved DEVON command |
| `GET /api/edits/{commandId}?poll=1` | Read/poll execution and receipt |
| `POST /api/edits/{commandId}` | Retry, cancel, or authenticated worker receipt |
| `GET /api/artifacts/{name}` | Authenticated self-hosted artifact download |
| `GET /api/sources` | Authenticated inventory and SHA-256 of private source media |

Master commands additionally require the named cut to have a recorded rubric pass.

## Self-hosted deployment

For picture and finishing work only — no clone voice, full motion, or lip sync —
`compose.local.yaml` runs the control plane and the FFmpeg worker alone, with no
provider credentials and no identity registry. That is the shortest path to
operating DEVON on one machine; see `docs/LOCAL_OPERATION.md`. The rest of this
section is the full stack.

The canonical self-hosted shape is `compose.yaml`: a private Next.js control plane,
an FFmpeg/FFprobe worker, a private identity-locked provider adapter, durable state
volumes, and artifact volumes. Only the web service publishes a host port.

Create `.env` from `.env.example` and set at least:

```dotenv
EDITFORGE_ACCESS_PASSWORD=<random browser password>
EDITFORGE_MCP_TOKEN=<random DEVON bearer token>
EDITFORGE_WORKER_TOKEN=<different random worker token>
EDITFORGE_PUBLIC_URL=http://localhost:3100
EDITFORGE_PORT=3100
EDITFORGE_SOURCE_MEDIA_HOST_DIR=/root/Media Assets
```

`EDITFORGE_SOURCE_MEDIA_HOST_DIR` defaults to `./media` and is mounted read-only into the web and worker
containers. `GET /api/sources` returns only each asset's relative name, byte size,
modified time, SHA-256, and an `editforge-source:///...` identifier. It never serves
the source bytes publicly. The worker resolves that identifier only inside the
read-only mount and verifies the command's SHA-256 before any provider or FFmpeg work.

For clone/full-motion work, copy `provider/identity-registry.example.json` to a
host path outside the repository, replace the placeholders with consented provider
identifiers, and configure the private adapter:

```dotenv
EDITFORGE_PROVIDER_TOKEN=<different random adapter bearer token>
EDITFORGE_IDENTITY_REGISTRY_FILE=/absolute/host/path/editforge-identities.json
EDITFORGE_RUNWAY_CHARACTER_FILE=/absolute/host/path/tee-runway-clone-reference.png
EDITFORGE_PROVIDER_MAX_CREDITS_PER_JOB=100
EDITFORGE_VOICE_MAX_CHARACTERS_PER_JOB=5000
RUNWAYML_API_SECRET=<Runway developer key>
ELEVENLABS_API_KEY=<ElevenLabs key>
```

For a private local Runway character reference, set `runwayCharacterFile` in the
identity registry to `/run/secrets/tee-runway-clone-reference.png` and start the
stack with both Compose files:

```bash
docker compose -f compose.yaml -f compose.identity-reference.example.yaml up -d --build
```

The provider accepts only PNG, JPEG, or WebP files inside `/run/secrets`, enforces
Runway's 16 MB inline limit, and converts the image to a data URI inside the private
provider container. The canonical likeness is never published as a web URL.

The built-in adapter maps `synthesize-voice` to the registry-locked ElevenLabs
voice, `lip-sync` to the registry-locked Runway custom avatar, and
`generate-full-motion` to Runway Act-Two using the registry-locked character
reference. Provider IDs and API keys never enter a DEVON command or receipt. The
adapter refuses a command when its identity, property, consent flag, or registry
record does not match.

Paid Runway operations must carry `params.maxCredits`; voice operations must carry
`params.maxCharacters`. The adapter applies the lower of the operation approval and
host ceiling and cancels a Runway task if its reported estimate exceeds that ceiling.
No paid smoke render should be submitted until Tee approves the exact identity,
source assets, and per-job ceiling.

`EDITFORGE_TIMELINE_ADAPTER_URL` remains optional for nonlinear assembly. The FFmpeg
worker already executes trims, reframes, derivatives, speed, captions, audio mix,
grade, and preview/master encoding locally.

Production source and signed-upload URLs must use HTTPS and cannot target private
addresses by default. The Compose stack allowlists only its internal provider origin
through `EDITFORGE_TRUSTED_MEDIA_ORIGINS`. A deliberately private on-prem media server
can be enabled more broadly with `EDITFORGE_ALLOW_PRIVATE_MEDIA_URLS=true` only when
the entire render network is trusted.

Then:

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:3100/api/health
```

Set DEVON's API environment to:

```dotenv
EDITFORGE_URL=http://host.docker.internal:3100
EDITFORGE_TOKEN=<same value as EDITFORGE_MCP_TOKEN>
```

DEVON can then authorize, execute, poll, retry, and cancel through
`/api/v1/devon/editforge/*`. When DEVON runs outside Docker on the same host, use
`http://localhost:3100` instead.

## Adapter contract

Each adapter receives the locked command, the current hashed input artifact, and one
operation. It must return:

```json
{
  "artifact": {
    "uri": "https://media.example/revision.mp4",
    "sha256": "64-hex-character-sha256",
    "mediaType": "video/mp4"
  }
}
```

Adapters authenticate with `EDITFORGE_PROVIDER_TOKEN`. EditForge verifies the final
input hash before FFmpeg and the final output hash after FFmpeg. Provider credentials
never enter the edit command or receipt.

## Operational truth

The command contract, approval binding, durable execution store, FFmpeg plan,
self-hosted artifact path, cancellation protection, tests, and production build are
implemented. A real local FFmpeg smoke render completed from HTTP source through source
hash verification, reframe, encode, FFprobe, artifact storage, and hashed receipt. A
live clone/full-motion provider render still requires the user's actual
adapter endpoints, credentials, consented clone id, voice id, and source media; no
repository can truthfully manufacture or validate those secrets.
