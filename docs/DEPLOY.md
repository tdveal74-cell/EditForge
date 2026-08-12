# EditForge — Deploy & Durable Store

Production runs on Vercel at **https://editforge.vercel.app**.

Two setup steps require dashboard/CLI access with an authenticated Vercel account — they
cannot be done from a headless agent session. Both are recorded here so the state of the
deployment is never only in chat history.

## 1. Connect the project to GitHub (push-to-deploy)

Until this is done, deployments are **file-uploaded**, not git-triggered: pushing to
`main` does not redeploy.

**Dashboard:** Vercel → project `editforge` → Settings → Git → *Connect Git Repository* →
GitHub → `tdveal74-cell/EditForge`. Production branch: `main`.

**CLI equivalent** (from a clone, after `vercel login` + `vercel link`):

```bash
vercel git connect
```

Once connected: pushes to `main` deploy to production, and pull requests get preview
deployments automatically.

## 2. Provision the durable store (Redis / KV)

`lib/store.ts` speaks the Upstash-compatible Redis REST API. It needs **one complete
credential pair**, either naming scheme:

| Scheme | Variables |
|--------|-----------|
| Vercel KV | `KV_REST_API_URL` + `KV_REST_API_TOKEN` |
| Upstash | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |

A half-set pair is ignored on purpose — mixing a URL from one scheme with a token from
the other would authenticate against the wrong host.

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

The `store` field is the source of truth:

```json
{ "status": "healthy", "service": "editforge", "store": "kv" }
```

`"store": "file"` means the credentials are not reaching the function — check that the
resource is connected to the **Production** environment and that a redeploy has happened
since.

Round-trip the real path once the store reads `kv`:

```bash
curl -s -X POST https://editforge.vercel.app/api/cuts \
  -H 'Content-Type: application/json' -d '{"title":"durability check"}'
curl -s https://editforge.vercel.app/api/cuts   # the cut is still listed later, from any instance
```

## Secrets

Never commit real keys. `.env.example` lists the provider variables; storage credentials
are injected by Vercel and should not be copied into the repo.
