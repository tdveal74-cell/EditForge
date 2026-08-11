# How to test EditForge

```bash
git clone https://github.com/tdveal74-cell/EditForge.git
cd EditForge
pnpm install
pnpm test
pnpm dev
```

Open http://localhost:3000 — start at `/studio`.

| Check | URL |
|-------|-----|
| Studio map | /studio |
| Long-form | /longform |
| Gen video | /gen-video |
| Voice | /voice |
| Avatar | /avatar |
| Rubric | /rubric |
| Health | /api/health |

Optional env (never commit secrets):
```
ELEVENLABS_API_KEY=
RUNWAY_API_KEY=
KLING_API_KEY=
VEO_API_KEY=
SEEDREAM_API_KEY=
```
