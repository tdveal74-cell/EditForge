# Operating DEVON locally against EditForge

**Updated:** 2026-08-30

DEVON can drive the whole media execution lane on one machine, with nothing
reaching `editforge.online`. This is the runbook for that shape.

It is the same boundary as everywhere else: DEVON is the sole orchestration and
approval authority, EditForge is the media execution engine. Running both on
localhost changes the address, not the authority.

## What runs locally, and what does not

| Lane | Local | Needs |
|---|---|---|
| `trim`, `reframe`, `derive-short`, `speed`, `captions`, `audio-mix`, `grade`, preview and master encoding | yes | nothing beyond this stack |
| `split`, `reorder`, `replace-shot`, `title`, `transition`, episode and compilation assembly | no | `EDITFORGE_TIMELINE_ADAPTER_URL` |
| `synthesize-voice`, `generate-full-motion`, `lip-sync` | no | the full `compose.yaml`, a consented identity registry, and a per-job ceiling |

The FFmpeg worker compiles the first row itself. The other two rows are adapter
work, and their adapter URLs are unset in the local stack — an accepted operation
without a compiler or adapter **fails**; it is never silently skipped. Nothing in
this stack can spend money at a provider.

For clone voice, full motion, or lip sync, use `compose.yaml` and
`docs/DEVON_EXECUTION.md` instead. That path is deliberately separate: it holds
its own credentials, and no paid render should be submitted before Tee approves
the exact identity, source assets, and per-job ceiling.

## Bring the studio up

```bash
./scripts/devon-local.sh
```

It checks Docker, writes `.env`, generates the three local tokens once, builds
and starts the web control plane and the FFmpeg worker, waits for health, and
prints DEVON's two lines at the end. Re-running it reuses the `.env`, the
volumes, and the tokens — it rotates nothing.

The stack it starts is `compose.local.yaml`: `compose.yaml` minus the
identity-locked provider service and its required registry secret. It runs under
its own Compose project name, so it never collides with the full stack's
containers or volumes.

### Without Docker

Where Docker is unavailable, or its registry is unreachable (a sandboxed agent
session is the usual case), the same two services run as plain Node processes:

```bash
./scripts/devon-local-nodocker.sh          # up
./scripts/devon-local-nodocker.sh stop     # down
```

It shares `.env` with the Compose runner on purpose, so DEVON's token is the
same whichever one brought the studio up. State goes under `.local-run/`.

What you give up: container isolation, the pinned `node:20-bookworm-slim` base,
and the named volumes. It uses whatever `ffmpeg` is on `PATH`, and without
`ffmpeg` and `ffprobe` the worker reports degraded and `executionReady` is
false. It exercises and verifies the lane; it is not the way to run a studio
people depend on. For that, use the Compose runner above.

Doing it by hand instead:

```bash
cp .env.example .env          # then set the three tokens below
docker compose -f compose.local.yaml up -d --build
curl -fsS http://localhost:3100/api/health
```

The three that must be set, each a different random value:

```dotenv
EDITFORGE_ACCESS_PASSWORD=<browser password for the deployment>
EDITFORGE_MCP_TOKEN=<DEVON's bearer token>
EDITFORGE_WORKER_TOKEN=<control plane -> worker, DEVON never sees it>
```

Optional, and usually worth setting:

```dotenv
EDITFORGE_PORT=3100
EDITFORGE_PUBLIC_URL=http://localhost:3100
EDITFORGE_SOURCE_MEDIA_HOST_DIR=/root/Media Assets
```

`EDITFORGE_SOURCE_MEDIA_HOST_DIR` defaults to `./media` and is mounted read-only
into both containers. `GET /api/sources` returns only each asset's relative name,
size, modified time, SHA-256, and an `editforge-source:///...` identifier; the
bytes are never served publicly. Because a local edit reads its source through
that identifier rather than an HTTP URL, the private-address rules that govern
`https://` sources never come into it — there is no reason to set
`EDITFORGE_ALLOW_PRIVATE_MEDIA_URLS` here.

Read health honestly before trusting it. `status: healthy` only means the store
answered. The field that says edits will actually run is `executionReady`, which
requires the worker to be both configured and reachable.

## Point DEVON at it

DEVON reaches EditForge through two settings, and both default to the hosted
deployment. Set them in `Meta-Supreme-Apex-Genesis-/.env`:

```dotenv
EDITFORGE_URL=http://localhost:3100
EDITFORGE_TOKEN=<the same value as EDITFORGE_MCP_TOKEN above>
```

`start-devon.sh` writes that pair into a fresh `.env` already, and adds it to an
existing one that predates this lane. Where DEVON itself runs in Docker on the
same machine, use `http://host.docker.internal:3100`.

Then confirm the credential rather than assuming it:

```bash
curl -fsS -H "Authorization: Bearer $EDITFORGE_TOKEN" \
  http://localhost:3100/api/edits
```

`/api/health` is deliberately open, so reaching it proves nothing about the
token. `/api/edits` is the boundary every command travels, so an authenticated
read there proves the credential works for the thing execution actually needs —
and spends nothing. DEVON's own `read_editforge_status` makes the same check.

DEVON then authorizes, executes, polls, retries, and cancels through
`/api/v1/devon/editforge/*` exactly as it does against the hosted deployment.

## Point this repo's MCP connector at it

`.mcp.json` defaults to the hosted studio and reads an override from the
environment. Export both before starting Claude Code:

```bash
export EDITFORGE_MCP_URL=http://localhost:3100/api/mcp
export EDITFORGE_MCP_TOKEN=<the same token again>
```

Unset, it goes back to `https://editforge.online/api/mcp`.

## When it does not work

| Symptom | Cause |
|---|---|
| `docker compose` exits complaining a variable is unset | one of the three tokens is missing from `.env` |
| Health answers, `executionReady` is false | the worker did not start, or `ffmpeg`/`ffprobe` are missing. `/api/health` answers **503** in this state, so a plain `curl -f` reports it as no answer at all — read the body. `docker compose -f compose.local.yaml logs worker`, or `.local-run/worker.log` |
| DEVON says "EditForge URL and token are required" | `EDITFORGE_TOKEN` is unset on DEVON's side; the lane fails closed rather than calling unauthenticated |
| A command fails naming an adapter env var | that operation is not in the local stack — see the table above |
| MCP still reaching `editforge.online` | `EDITFORGE_MCP_URL` was not exported into the process that starts Claude Code |

Stop the stack with `docker compose -f compose.local.yaml down`. Add `-v` only
when you mean to discard the local edit state and artifacts too.
