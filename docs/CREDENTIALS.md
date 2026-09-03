# Credentials — wiring EditForge to live providers

Everything here is names and destinations. No key values live in this
repository, and no endpoint in the app will ever read one back out: `/api/health`,
`/api/providers` and the `editforge_status` MCP tool report **whether** a
variable is set, never what it holds.

## The shape of it

EditForge has two provider boundaries, and they are separate on purpose.

| | Studio control plane | DEVON execution path |
|---|---|---|
| Where | `lib/providers.ts` | `provider/server.mjs` behind `worker/` |
| Reached from | `/gen-video`, `/voice`, `/avatar`, `/api/jobs`, MCP | `/api/edits`, DEVON commands |
| Gate | authentication + rubric before master | identity registry: consent, clone, voice, version, per-operation credit ceiling |
| Credentials | the studio variables below | its own, never shared into commands |

A key set for one is not set for the other. That is the point: the identity-locked
path must not become reachable by anything that can reach the studio.

## Studio control plane

### Gen video — Runway

| Variable | Required | What it is |
|---|---|---|
| `RUNWAY_API_KEY` | yes | Runway API key. `RUNWAYML_API_SECRET` — the name Runway's own SDK uses — is accepted as an alias, so a host that already set it for the DEVON adapter does not need it twice. |

Wired to `POST /v1/text_to_video` and `GET /v1/tasks/{id}`, pinned to API version
`2024-11-06`. Text-to-video renders **16:9 or 9:16 only**, for **2–10 seconds**;
the boundary refuses anything else before making the call rather than collecting
a 400.

Kling, Veo and Seedream are in the registry with their key names but have no
implemented API shape. They refuse rather than pretend, and `/api/providers`
reports them `wired: false`.

### Voice — ElevenLabs

| Variable | Required | What it is |
|---|---|---|
| `ELEVENLABS_API_KEY` | yes | Sent as `xi-api-key`. A bearer token here is a 401 that looks exactly like a bad key. |
| `ELEVENLABS_VOICE_ID` | yes¹ | Default provider voice id. |
| `ELEVENLABS_VOICE_ID_<SLUG>` | no | Pins one studio voice to its own provider voice. `vo-auren` reads `ELEVENLABS_VOICE_ID_AUREN`; `vo-stock-narrator` reads `ELEVENLABS_VOICE_ID_STOCK_NARRATOR`. |
| `EDITFORGE_ARTIFACT_DIR` | yes | See below. |

¹ Either the default or a per-voice pin for the voice being run.

Text-to-speech answers with the audio bytes themselves — there is no task id and
nothing to poll. The boundary stores what comes back in the artifact store and
records the file as the job's result, so **without `EDITFORGE_ARTIFACT_DIR` a
voice run refuses before spending anything.** Paying for audio and dropping it is
worse than not starting.

### Avatar — HeyGen

| Variable | Required | What it is |
|---|---|---|
| `HEYGEN_API_KEY` | yes | Sent as `X-Api-Key`. |
| `HEYGEN_AVATAR_ID` | yes | The avatar look to render. |
| `HEYGEN_VOICE_ID` | yes | The voice HeyGen speaks the script in. |

Wired to `POST /v3/videos` and `GET /v3/videos/{id}`. All three are required: a
render refused for a missing look id is not a credential problem, and
`/api/providers` names which one is missing so it does not read like one.

### Artifact store

| Variable | Required | What it is |
|---|---|---|
| `EDITFORGE_ARTIFACT_DIR` | for voice | Directory rendered media is written to. `compose.yaml` mounts a shared volume at `/artifacts`. |
| `EDITFORGE_ARTIFACT_BASE_URL` | no | Absolute base for artifact links. Defaults to `EDITFORGE_PUBLIC_URL/api/artifacts`, then to a relative `/api/artifacts`. |

Files are content-addressed — the same bytes always land on the same name, so a
retried submit does not accumulate near-duplicates. `/api/artifacts/[name]`
serves them behind the same authentication as the rest of the app.

That last part has a consequence worth knowing: a browser authenticates with the
session cookie from `/login`, which only exists when `EDITFORGE_ACCESS_PASSWORD`
is set. On a deployment holding only `EDITFORGE_MCP_TOKEN`, jobs run fine through
MCP but nobody can open the result in a browser. **Set the access password on any
deployment where people will watch or listen to what it renders.**

**On Vercel this store is not durable.** A serverless filesystem is per-instance
and vanishes between invocations, so voice belongs on the self-hosted stack (or
on a deployment with a persistent volume). `/api/health` reports
`artifactStore: false` when it is unset, which is the honest answer rather than a
link that 404s a minute later.

## Access control

| Variable | What it does |
|---|---|
| `EDITFORGE_ACCESS_PASSWORD` | Makes the whole deployment private: pages redirect to `/login`, APIs answer 401. |
| `EDITFORGE_SESSION_SECRET` | Signs browser sessions. Use a long random value different from the access password. |
| `EDITFORGE_MCP_TOKEN` | Lets an MCP client run the state-changing tools. |

Spending money always requires authentication, whether or not a password is set.
With neither request credential configured, production fails closed and local
development cannot reach billable providers. Set all three values for a browser
deployment, with a different random value for each.

## Durable store

| Variable | What it does |
|---|---|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV / Upstash Redis REST. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` work too. |

Without these the studio falls back to a file store, which is ephemeral and
per-instance on Vercel — a job submitted by one instance is invisible to the
next. `/api/health` reports the active backend and why it fell back.

## DEVON execution path

Set on the worker and provider services, never on the control plane. See
`docs/DEVON_EXECUTION.md` for the identity registry itself.

| Variable | Where | What it is |
|---|---|---|
| `EDITFORGE_WORKER_URL` / `EDITFORGE_WORKER_TOKEN` | web | How the control plane reaches the render worker. |
| `EDITFORGE_PROVIDER_TOKEN` | worker, provider | Shared token for the private adapter. |
| `EDITFORGE_IDENTITY_REGISTRY_FILE` | provider | Host file of consented identities. Keep it outside the repository. |
| `EDITFORGE_RUNWAY_CHARACTER_FILE` | provider | Optional private Runway character image mounted read-only by the identity-reference Compose overlay. |
| `EDITFORGE_PROVIDER_MAX_CREDITS_PER_JOB` | provider | Host ceiling. The effective ceiling is the lower of this and the approved command's own. |
| `EDITFORGE_VOICE_MAX_CHARACTERS_PER_JOB` | provider | Host ceiling on script length. |
| `RUNWAYML_API_SECRET` | provider | Runway key for Act-Two motion and avatar lip-sync. |
| `ELEVENLABS_API_KEY` | provider | ElevenLabs key for the identity-locked voice adapter. |

### Secure self-hosted setup

On a self-hosted EditForge server, configure Runway, ElevenLabs and HeyGen
without placing any secret in shell history:

```bash
cd /opt/editforge/app
python3 scripts/configure-provider-credentials.py
```

Runway and ElevenLabs are required. **HeyGen is optional** — leave its prompt
blank, or pass `--skip-avatar`, and the avatar path is left alone rather than
written half-configured.

If the ids are already known, validate and bind them exactly instead of choosing
from a display-name list:

```bash
python3 scripts/configure-provider-credentials.py \
  --elevenlabs-voice-id VOICE_ID \
  --heygen-avatar-id AVATAR_ID --heygen-voice-id VOICE_ID
```

Either selection can be redone later against the already stored key, without
re-entering any secret:

```bash
python3 scripts/configure-provider-credentials.py --select-elevenlabs-voice
python3 scripts/configure-provider-credentials.py --select-heygen-avatar
```

The script uses hidden prompts, writes `.env` and the identity registry
atomically with mode `0600`, verifies the private Runway character reference,
and selects voices and avatar looks by display name while keeping their internal
ids off the command line. It never prints an API key.

#### The voice is bound to two places

The two provider boundaries above each read the ElevenLabs voice from their own
source: the DEVON adapter reads `elevenlabsVoiceId` from the identity registry,
and the studio's `/voice` path reads `ELEVENLABS_VOICE_ID` from the environment.
The script writes **both**, because writing only the registry produced a server
whose setup reported success and whose voice page still refused for a missing
voice id.

A server configured before this was fixed has the registry entry and not the
environment one. Re-run `--select-elevenlabs-voice` to bind it; `--check` reports
`studioVoiceConfigured: false` until you do.

Confirm only non-secret configuration state with:

```bash
python3 scripts/configure-provider-credentials.py --check
```

It exits non-zero if anything required is missing. HeyGen's absence is not a
failure — but a HeyGen key with no avatar or voice id behind it is, since every
avatar render would refuse.

## Where to set them

**Vercel** — Project → Settings → Environment Variables, Production and Preview.
Redeploy after changing them; Next.js reads `process.env` at request time on the
server, but a running deployment keeps the values it booted with.

Suitable there: `RUNWAY_API_KEY`, `HEYGEN_*`, `EDITFORGE_ACCESS_PASSWORD`,
`EDITFORGE_MCP_TOKEN`, `KV_REST_API_*`.
Not suitable there: `ELEVENLABS_*` (needs the durable artifact store) and the
whole DEVON path (needs the worker and provider services).

**Self-host** — put them in a `.env` beside `compose.yaml`; every variable above
is already threaded into the right service. Then:

```bash
docker compose up -d --build
```

**Local dev** — `.env.local`, from `.env.example`.

## Verifying, without reading a single secret

```bash
curl -s localhost:3000/api/health    | python3 -m json.tool
curl -s localhost:3000/api/providers | python3 -m json.tool
```

`/api/health` should report `storeReachable: true`, and `artifactStore: true` if
you intend to run voice. For each provider, `/api/providers` answers three
separate questions, and they fail differently:

- `wired` — is this provider's API shape implemented here at all?
- `credentialSet` — is its key set, under any of the names in `envKeys`?
- `settingsMissing` — what else does it still need? (`HEYGEN_AVATAR_ID`, and so on)

`billable: true` means all of them hold and a run would reach the provider and
charge for it. The picker on each media page shows the same three answers in
words, so a refusal is diagnosed before the click rather than after.

Then run one job against `mock` on `/voice`, `/avatar` or `/gen-video`. The
lifecycle is real, the media is not, and nothing is charged — if that path works,
the only thing a live key changes is which provider answers.
