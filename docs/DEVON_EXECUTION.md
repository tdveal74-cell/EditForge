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
and lip sync use the voice, motion, and lip-sync adapter URLs. An accepted operation
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

Master commands additionally require the named cut to have a recorded rubric pass.

## Self-hosted deployment

The canonical self-hosted shape is `compose.yaml`: a private Next.js control plane,
an FFmpeg/FFprobe worker, durable state volumes, and a shared artifact volume. The
worker has no published host port; EditForge reaches it on the compose network.

Create `.env` from `.env.example` and set at least:

```dotenv
EDITFORGE_ACCESS_PASSWORD=<random browser password>
EDITFORGE_MCP_TOKEN=<random DEVON bearer token>
EDITFORGE_WORKER_TOKEN=<different random worker token>
EDITFORGE_PUBLIC_URL=http://localhost:3100
EDITFORGE_PORT=3100
```

For clone/full-motion work, also configure the adapter boundary:

```dotenv
EDITFORGE_PROVIDER_TOKEN=<adapter bearer token>
EDITFORGE_VOICE_ADAPTER_URL=https://voice-adapter.example/v1/render
EDITFORGE_MOTION_ADAPTER_URL=https://motion-adapter.example/v1/render
EDITFORGE_LIPSYNC_ADAPTER_URL=https://lipsync-adapter.example/v1/render
EDITFORGE_TIMELINE_ADAPTER_URL=https://timeline-adapter.example/v1/render
```

Production source and signed-upload URLs must use HTTPS and cannot target private
addresses by default. A deliberately private on-prem media server can be enabled with
`EDITFORGE_ALLOW_PRIVATE_MEDIA_URLS=true` only when the render network is trusted.

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
