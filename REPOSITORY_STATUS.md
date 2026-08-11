# REPOSITORY_STATUS — EditForge

**Updated:** 2026-08-11

| Field | Value |
|-------|--------|
| Product | EditForge — post-production Studio OS |
| Canonical runtime | Next.js 15 app (`app/`, `lib/`) local + plan APIs |
| Completion vocabulary | **code-complete** for Studio plan/control plane MVP |
| Not proven | Live provider renders, Vercel deploy, durable job lifecycle with full idempotency |
| Required checks | `.github/workflows/ci.yml` — install, typecheck, test, build |
| Entry points | `pnpm install && pnpm test && pnpm dev` · `/studio` |
| Known blockers | Provider keys + worker for live renders; CI must pass on main |
| Deployment | None required for MVP; Vercel only with explicit approve |
| Quality gate in code | Master export blocked without rubric pass (`lib/ffmpeg.ts`) |
