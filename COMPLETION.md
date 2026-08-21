# EditForge — production control plane and worker

## Definition of done (this repo)
Studio OS code is **complete** for local run + plan APIs.

### Operational
- [x] Studio department map
- [x] Pipeline, projects, dailies, script
- [x] Timeline, color, audio, captions, titles
- [x] Assets, review, rubric (saves pass to cut)
- [x] Export, jobs, presets, archive, collab
- [x] Long-form chapters + stitch plan
- [x] Flagship tokens + Nav
- [x] AAA design system: full token ramps, elevation, motion, a11y floor (2026-08-12)
- [x] Shared primitives: Button · Card · Badge · PageHeader
- [x] Hardware reference tier: `lib/hardware.ts` · `/hardware` · `docs/HARDWARE.md`

### AI media
- [x] Voice (ElevenLabs-class)
- [x] Avatar / HyperFrames
- [x] Gen video (Runway · Kling · Veo · Seedream)
- [x] Stock (Artlist-class index)
- [x] Self-hosted Forge Worker with authenticated uploads, provenance, durable jobs, artifact streaming, and honest engine-readiness gates
- [x] Chatterbox, LivePortrait, MuseTalk, LTX-Video, and FFmpeg adapters
- [x] Ascension Caudex 12-episode 4K production lane
- [x] TSWS Microdrama Grok Visuals source registry and long-form protection boundary

### Bridges
- [x] NLE · mix · VFX engine · MAM · render farm

### Tests authored
- [x] restraint · ffmpeg · grade · longform · jobs · genvideo · hardware

### Governance (2026-08-11)
- [x] `REPOSITORY_STATUS.md`
- [x] `.github/workflows/ci.yml` (install · typecheck · test · build)

## Still requires production infrastructure
- [ ] GPU-host proof render with the official model weights and accepted licenses
- [ ] Vercel deploy (explicit approve)
- [ ] Foundation-model training
- [ ] Durable object storage/queue deployment for multi-instance production scale

## Verify
```bash
npm install && npm test && npm run build && npm run dev
```

**Status: control plane and self-hosted worker code-complete · GPU inference proof pending · paid providers disabled by default.**
