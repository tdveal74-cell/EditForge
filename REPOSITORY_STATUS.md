# REPOSITORY_STATUS — EditForge

**Updated:** 2026-08-20

| Field | Value |
|-------|--------|
| Product | EditForge — post-production Studio OS |
| Canonical runtime | Next.js 15 app (`app/`, `lib/`) local + plan APIs |
| Completion vocabulary | **code-complete** for Studio plan/control plane MVP |
| Job lifecycle | `lib/jobs.ts` — planned→authorized→queued→running→validating→completed/failed/cancelled + rubric decision record |
| Provider boundary | `lib/providers.ts` — the one place a provider is called. Fails closed without credentials, never invents an external id, mock always labelled and returns no media |
| Zero-cost engine control | `lib/spend-policy.ts` + `lib/engine-capabilities.ts` + `/engines` — Persona, Cinema, and Edit capability registry; paid remote providers hard-blocked by default. Controlled billing remains preflight-only until the atomic spend ledger is implemented. |
| Worker path | `worker/forge_worker.py` + `lib/forge-worker.ts` + `lib/jobstore.ts` — authenticated uploads, durable submit/poll, real artifact streaming, consent checks, FFmpeg mastering, and explicit model/license readiness |
| Property production | `/ascension` owns the 12×90-second Ascension Thread lane. `/tsws-microdrama` owns the creator-authored Grok Visuals cut and explicitly excludes the TSWS long-form Season One ZIP. |
| Gen-video boundary | `lib/genvideo.ts` `submitGenVideo` — planning only; execution goes through `lib/providers.ts` |
| Deployed | Vercel production — https://editforge.vercel.app · git-connected: pushes to `main` deploy, PRs get previews |
| Durable store | **Live** — Redis (REST) active in production, verified 2026-08-12: `/api/health` reports `store: kv` + `storeReachable: true`, and repeat `/api/cuts` reads return identical timestamps across instances |
| Not proven | End-to-end GPU inference with the official Chatterbox, LivePortrait, MuseTalk, and LTX weights. The worker refuses missing engines rather than fabricating media. Paid remote providers remain hard-disabled in zero-cost mode. |
| Claude integration | MCP connector at `/api/mcp` (stateless JSON-RPC, in-app), skill at `skills/editforge/`, Claude Code plugin at `.claude-plugin/`. Read tools open; `submit_media_job` and `drive_job` require `EDITFORGE_MCP_TOKEN` and fail closed when it is unset. See `docs/CLAUDE_INTEGRATION.md` |
| Required checks | `.github/workflows/ci.yml` |
| Entry points | `npm install && npm test && npm run build && npm run dev` · `/studio` |
| Quality gate | Master export blocked without rubric pass |
| Design system | AAA flagship tokens + primitives (`docs/FLAGSHIP_SPEC.md`, `components/ui/`) — Button/Card/Badge/PageHeader, a11y floor WCAG 2.2 AA |
| Hardware spec | `lib/hardware.ts` + `/hardware` + `docs/HARDWARE.md` — suite classes, storage 3-2-1, farm; reference classes, not SKUs |
| Cuts store | `lib/store.ts` — Vercel KV/Upstash (durable) when `KV_REST_API_*`/`UPSTASH_REDIS_REST_*` env present; file store fallback (`/tmp` on Vercel, ephemeral). `/api/health` reports active backend |
