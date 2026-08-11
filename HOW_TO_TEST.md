# How to test EditForge

```bash
pnpm install
pnpm test
pnpm dev
```

- / — home
- /rubric — restraint
- /projects — cuts API + store
- /presets — TSWS lanes
- /jobs — stubs
- GET /api/health

ffmpeg plan (does not execute):
```bash
curl -s -X POST http://localhost:3000/api/ffmpeg/plan \
  -H 'content-type: application/json' \
  -d '{"kind":"export","rubricPass":false}'
```

Vercel deploy requires explicit approve.
