# EditForge — MVP complete

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

### AI media (plan + keys)
- [x] Voice (ElevenLabs-class)
- [x] Avatar / HyperFrames
- [x] Gen video (Runway · Kling · Veo · Seedream)
- [x] Stock (Artlist-class index)

### Bridges
- [x] NLE · mix · VFX engine · MAM · render farm

### Tests authored
- [x] restraint · ffmpeg · grade · longform

### Governance (2026-08-11)
- [x] `REPOSITORY_STATUS.md`
- [x] `.github/workflows/ci.yml` (install · typecheck · test · build)

## Not in this MVP
- [ ] Live provider renders (API keys + worker)
- [ ] Vercel deploy (explicit approve)
- [ ] Foundation-model training
- [ ] Full durable job state machine with immutable rubric decision records

## Verify
```bash
npm install && npm test && npm run build && npm run dev
```

**Status: MVP code-complete · CI defined · not live-provider-complete.**
