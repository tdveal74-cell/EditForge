# EditForge — deployment and durable store

EditForge supports two deployment shapes:

- `compose.yaml` self-hosts the Next.js control plane, FFmpeg worker, private
  identity-locked provider adapter, durable state, and artifact volumes. This is
  the recommended DEVON-operated shape. See
  `docs/DEVON_EXECUTION.md`.
- Vercel hosts the control plane. A separately deployed worker is still required for
  real edit execution.

The existing hosted control plane runs on Vercel at **https://editforge.vercel.app**.

**Both setup steps below are done** (2026-08-12): the project is git-connected and a
Redis store is live. They are kept here as the record of how the deployment is wired,
and as the runbook for rebuilding it elsewhere.

## 1. Connect the project to GitHub (push-to-deploy) — done

Without this, deployments are **file-uploaded**, not git-triggered: pushing to `main`
does not redeploy.

**Dashboard:** Vercel → project `editforge` → Settings → Git → *Connect Git Repository* →
GitHub → `tdveal74-cell/EditForge`. Production branch: `main`.

**CLI equivalent** (from a clone, after `vercel login` + `vercel link`):

```bash
vercel git connect
```

Once connected: pushes to `main` deploy to production, and pull requests get preview
deployments automatically.

## 2. Provision the durable store (Redis / KV) — done

`lib/store.ts` speaks the Upstash-compatible Redis REST API. It needs **one complete
credential pair**, either naming scheme:

| Scheme | Variables |
|--------|-----------|
| Vercel KV | `KV_REST_API_URL` + `KV_REST_API_TOKEN` |
| Upstash | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |

A half-set pair is ignored on purpose — mixing a URL from one scheme with a token from
the other would authenticate against the wrong host.

**A connection string is not enough.** A store that only attaches `REDIS_URL` (a TCP
`rediss://` string, which is what Vercel's native Redis and several marketplace options
provide by default) will *not* activate this backend — the client speaks HTTP REST, not
the Redis wire protocol. `/api/health` names this case explicitly in
`storeFallbackReason`. Pick a store that exposes REST credentials, or attach them
alongside the connection string.

**Dashboard:** Vercel → Storage → *Create Database* → Redis (Upstash, via Marketplace) →
create, then **Connect Project** → `editforge`, environments: Production (+ Preview and
Development if wanted). Connecting injects the credential env vars automatically.

**CLI equivalent:**

```bash
vercel integration resource connect <resource-name> editforge
```

Then redeploy so functions pick up the new environment.

### Behaviour before and after

- **No credentials** → file store. On Vercel that is `/tmp/editforge-data`, which is
  per-instance and ephemeral: cuts reset on cold starts and don't span instances. The app
  works, but production data is not durable.
- **Credentials present** → Redis store, keyed at `editforge:cuts`. Seeded once via
  `SET … NX`; every mutation is a compare-and-set (Lua `EVAL`) with retry, so overlapping
  serverless requests never overwrite each other.

No code change or redeploy of source is needed to switch — only the env vars and a
redeploy of the existing build.

## 3. Verify

```bash
curl -s https://editforge.vercel.app/api/health
```

Two fields, and both matter:

```json
{ "status": "healthy", "store": "kv", "storeReachable": true }
```

- `store` — which backend the env vars **select**. `"file"` means the credentials aren't
  reaching the function: check the resource is connected to the **Production**
  environment and that a redeploy has happened since.
- `storeReachable` — whether that backend actually **answered**. The endpoint issues a
  live `PING` (Redis) or a directory check (file), so a complete-but-invalid, expired, or
  unreachable credential pair reports `"store": "kv"` with `storeReachable: false`,
  `status: "degraded"`, HTTP 503, and a `storeError` string. Setup is only done when both
  `store` is `kv` and `storeReachable` is `true`.

The probe is read-only and writes nothing, so it is safe to run against production as
often as needed. Avoid `POST /api/cuts` as a smoke test — there is no delete endpoint, so
every test cut persists in the shared store forever.

## Secrets

Never commit real keys. `.env.example` lists the provider variables; storage credentials
are injected by Vercel and should not be copied into the repo.
