# How to test EditForge

```bash
pnpm install
pnpm test
pnpm dev
```

| URL | Expect |
|-----|--------|
| `/studio` | Full department map |
| `/longform` | Chapters + stitch plan |
| `/gen-video` | Provider plan JSON |
| `/voice` | Voice plan |
| `/avatar` | HyperFrames plan |
| `/rubric` | Save pass on cut |
| `/api/health` | JSON ok |

Optional: copy `.env.example` → `.env.local` and set keys.
