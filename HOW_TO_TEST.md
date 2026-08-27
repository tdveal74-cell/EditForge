# How to test EditForge

```bash
npm install
npm test
npm run dev
```

| URL | Expect |
|-----|--------|
| `/studio` | Full department map |
| `/longform` | Chapters + stitch plan |
| `/gen-video` | Provider plan JSON; picker marks each provider live or unavailable |
| `/voice` | Voice plan, naming any variable still missing |
| `/avatar` | Avatar plan, naming any variable still missing |
| `/rubric` | Save pass on cut |
| `/api/health` | JSON ok — store, worker and artifact-store readiness |
| `/api/providers` | Per provider: `wired`, `credentialSet`, `settingsMissing`, `billable` |

Run one job against **mock** on `/voice`, `/avatar` or `/gen-video`: the
lifecycle is real, the media is not, and nothing is charged. If that works, the
only thing a live key changes is which provider answers.

Live keys: copy `.env.example` → `.env.local` and see `docs/CREDENTIALS.md` for
which variable belongs where.
