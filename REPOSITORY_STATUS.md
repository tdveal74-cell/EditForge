# REPOSITORY_STATUS — EditForge

**Updated:** 2026-08-27

| Field | Value |
|-------|--------|
| Product | EditForge — post-production Studio OS |
| Canonical runtime | Next.js 15 app (`app/`, `lib/`) local + plan APIs |
| Completion vocabulary | **code-complete** for Studio control plane and DEVON-governed execution; live provider verification remains external |
| Job lifecycle | `lib/jobs.ts` — planned→authorized→queued→running→validating→completed/failed/cancelled + rubric decision record |
| Provider boundary | `lib/providers.ts` — the one place a provider is called; the registry it dispatches on is `lib/provider-registry.ts`, shared with the UI so a picker cannot offer what the boundary refuses. Fails closed without credentials, never invents an external id, mock always labelled and returns no media |
| Live wires | Runway gen-video (`text_to_video`/`tasks`), ElevenLabs voice (bytes back → artifact store), HeyGen avatar (`v3/videos`). Kling · Veo · Seedream registered, unimplemented, refusing. `docs/CREDENTIALS.md` is the wiring runbook |
| Artifact store | `lib/artifacts.ts` + `/api/artifacts/[name]` — content-addressed audio and video under `EDITFORGE_ARTIFACT_DIR`, authenticated, shared volume in `compose.yaml`. Not durable on Vercel, and `/api/health` says so |
| Worker path | `lib/jobstore.ts` + `/api/jobs` — durable submit · poll · complete · retry · cancel. Wired into `/voice`, `/avatar`, `/gen-video` via `components/JobRunner.tsx`; runs appear on `/jobs` |
| DEVON edit path | `/api/edits` + `lib/editing.ts` + `lib/editstore.ts` + `worker/` — exact approved intent, immutable revision, FFmpeg/adapters, hashed receipt, retry/cancel |
| Self-hosting | `compose.yaml` — Next.js control plane, private FFmpeg worker, durable state volumes, shared authenticated artifact store |
| Gen-video catalogue | `lib/genvideo.ts` — editorial metadata and readiness, derived from the registry. The old `submitGenVideo`, which returned a fabricated `live-…` id for work nothing had started, is removed; execution is `lib/providers.ts` alone |
| Deployed | Vercel production — https://editforge.online · git-connected: pushes to `main` deploy, PRs get previews |
| Durable store | **Live** — Redis (REST) active in production, verified 2026-08-12: `/api/health` reports `store: kv` + `storeReachable: true`, and repeat `/api/cuts` reads return identical timestamps across instances |
| Not proven | An end-to-end **live clone/full-motion** render against the user's consented clone/voice IDs and real adapter credentials; the repo fails closed when they are absent |
| Claude integration | MCP connector at `/api/mcp` (stateless JSON-RPC, in-app), skill at `skills/editforge/`, Claude Code plugin at `.claude-plugin/`. Read tools open; `submit_media_job` and `drive_job` require `EDITFORGE_MCP_TOKEN` and fail closed when it is unset. See `docs/CLAUDE_INTEGRATION.md` |
| Required checks | `.github/workflows/ci.yml` |
| Entry points | `npm install && npm test && npm run build && npm run dev` · `/studio` |
| Quality gate | Master export blocked without rubric pass |
| Design system | AAA flagship tokens + primitives (`docs/FLAGSHIP_SPEC.md`, `components/ui/`) — Button/Card/Badge/PageHeader, a11y floor WCAG 2.2 AA |
| Hardware spec | `lib/hardware.ts` + `/hardware` + `docs/HARDWARE.md` — suite classes, storage 3-2-1, farm; reference classes, not SKUs |
| Cuts store | `lib/store.ts` — Vercel KV/Upstash (durable) when `KV_REST_API_*`/`UPSTASH_REDIS_REST_*` env present; file store fallback (`/tmp` on Vercel, ephemeral). `/api/health` reports active backend |
