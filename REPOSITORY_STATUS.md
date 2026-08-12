# REPOSITORY_STATUS — EditForge

**Updated:** 2026-08-12

| Field | Value |
|-------|--------|
| Product | EditForge — post-production Studio OS |
| Canonical runtime | Next.js 15 app (`app/`, `lib/`) local + plan APIs |
| Completion vocabulary | **code-complete** for Studio plan/control plane MVP |
| Job lifecycle | `lib/jobs.ts` — planned→authorized→queued→running→validating→completed/failed/cancelled + rubric decision record |
| Gen-video boundary | `lib/genvideo.ts` `submitGenVideo` — mock always; live requires env key |
| Deployed | Vercel production — https://editforge.vercel.app · git-connected: pushes to `main` deploy, PRs get previews |
| Durable store | **Live** — Redis (REST) active in production, verified 2026-08-12: `/api/health` reports `store: kv` + `storeReachable: true`, and repeat `/api/cuts` reads return identical timestamps across instances |
| Not proven | Full live provider worker polling (voice · avatar · gen-video remain plan-only) |
| Required checks | `.github/workflows/ci.yml` |
| Entry points | `npm install && npm test && npm run build && npm run dev` · `/studio` |
| Quality gate | Master export blocked without rubric pass |
| Design system | AAA flagship tokens + primitives (`docs/FLAGSHIP_SPEC.md`, `components/ui/`) — Button/Card/Badge/PageHeader, a11y floor WCAG 2.2 AA |
| Hardware spec | `lib/hardware.ts` + `/hardware` + `docs/HARDWARE.md` — suite classes, storage 3-2-1, farm; reference classes, not SKUs |
| Cuts store | `lib/store.ts` — Vercel KV/Upstash (durable) when `KV_REST_API_*`/`UPSTASH_REDIS_REST_*` env present; file store fallback (`/tmp` on Vercel, ephemeral). `/api/health` reports active backend |
