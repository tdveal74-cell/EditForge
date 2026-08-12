# REPOSITORY_STATUS — EditForge

**Updated:** 2026-08-12

| Field | Value |
|-------|--------|
| Product | EditForge — post-production Studio OS |
| Canonical runtime | Next.js 15 app (`app/`, `lib/`) local + plan APIs |
| Completion vocabulary | **code-complete** for Studio plan/control plane MVP |
| Job lifecycle | `lib/jobs.ts` — planned→authorized→queued→running→validating→completed/failed/cancelled + rubric decision record |
| Provider boundary | `lib/providers.ts` — the one place a provider is called. Fails closed without credentials, never invents an external id, mock always labelled and returns no media |
| Worker path | `lib/jobstore.ts` + `/api/jobs` — durable submit · poll · complete · retry · cancel. Wired into `/voice`, `/avatar`, `/gen-video` via `components/JobRunner.tsx`; runs appear on `/jobs` |
| Gen-video boundary | `lib/genvideo.ts` `submitGenVideo` — planning only; execution goes through `lib/providers.ts` |
| Deployed | Vercel production — https://editforge.vercel.app · git-connected: pushes to `main` deploy, PRs get previews |
| Durable store | **Live** — Redis (REST) active in production, verified 2026-08-12: `/api/health` reports `store: kv` + `storeReachable: true`, and repeat `/api/cuts` reads return identical timestamps across instances |
| Not proven | An end-to-end **live** render against real provider credentials. The lifecycle is exercised in production against the mock path; `runway` and `elevenlabs` have wired endpoints but no key has been set, and `kling`/`veo`/`seedream` refuse with "no wired endpoint yet" by design |
| Required checks | `.github/workflows/ci.yml` |
| Entry points | `npm install && npm test && npm run build && npm run dev` · `/studio` |
| Quality gate | Master export blocked without rubric pass |
| Design system | AAA flagship tokens + primitives (`docs/FLAGSHIP_SPEC.md`, `components/ui/`) — Button/Card/Badge/PageHeader, a11y floor WCAG 2.2 AA |
| Hardware spec | `lib/hardware.ts` + `/hardware` + `docs/HARDWARE.md` — suite classes, storage 3-2-1, farm; reference classes, not SKUs |
| Cuts store | `lib/store.ts` — Vercel KV/Upstash (durable) when `KV_REST_API_*`/`UPSTASH_REDIS_REST_*` env present; file store fallback (`/tmp` on Vercel, ephemeral). `/api/health` reports active backend |
