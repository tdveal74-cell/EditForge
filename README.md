# EditForge

**Flagship production studio OS** with a provider-neutral control plane and a self-hosted media worker.

Persona · cinema · edit · full-motion character jobs · vertical 4K mastering · rubric ship gate.

```bash
pnpm install && pnpm test && pnpm dev
```

Production lanes:

- **`/ascension`** — Ascension Caudex Thread I: 12 separate 90-second 4K masters plus one combined Thread master.
- **`/tsws-microdrama`** — Tee-authored TSWS Microdrama from the Grok Visuals source registry. The TSWS long-form package is protected and excluded.
- **`/studio`** — general post-production operations.

Live: **https://editforge.vercel.app** — see `docs/DEPLOY.md` for git-connect + durable store setup.

The software defaults to zero-cost mode. Paid APIs remain fail-closed. Real Chatterbox, LivePortrait, MuseTalk, or LTX inference still requires a GPU host, official weights, and explicit license acceptance; FFmpeg mastering runs independently when FFmpeg is installed.

Docs: `worker/README.md` · `docs/STUDIO_OS.md` · `docs/FLAGSHIP_SPEC.md` · `docs/HARDWARE.md` · `docs/DEPLOY.md` · `docs/LONGFORM.md` · `docs/GEN_VIDEO.md` · `docs/AI_MEDIA.md` · `docs/ZERO_COST_ENGINES.md` · `COMPLETION.md`
