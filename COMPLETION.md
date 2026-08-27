# EditForge — execution completion record

## Definition of done (this repo)
Studio OS, the governed DEVON execution path, and the private provider adapter are
code-complete. Live provider readiness remains credential-, identity-, and host-dependent.

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

### AI media (plan + keys)
- [x] Voice (ElevenLabs-class)
- [x] Avatar / HyperFrames
- [x] Gen video (Runway · Kling · Veo · Seedream)
- [x] Stock (Artlist-class index)

### Bridges
- [x] NLE · mix · VFX engine · MAM · render farm

### DEVON execution (2026-08-26)
- [x] Exact-intent DEVON command contract and operation scopes
- [x] Durable idempotent edit execution and immutable revision ids
- [x] Long-form, short-form, and full-motion micro-drama routing
- [x] Clone/voice/version/consent identity lock
- [x] FFmpeg/FFprobe worker with source and artifact SHA-256 checks
- [x] Voice, motion, lip-sync, and nonlinear timeline adapter seams
- [x] Private ElevenLabs voice, Runway avatar lip-sync, and Act-Two full-motion adapter
- [x] External identity registry with consent, property, clone, voice, and version locks
- [x] Per-operation provider ceilings bound into DEVON approval and enforced at execution
- [x] Preview/master outputs with recorded rubric gate for masters
- [x] Retry, cancel, polling, callback, and late-receipt cancellation protection
- [x] Self-hosted Docker Compose web, worker, provider, durable state, and artifacts

### Tests authored
- [x] restraint · ffmpeg · grade · longform · jobs · genvideo · hardware

### Governance (2026-08-11)
- [x] `REPOSITORY_STATUS.md`
- [x] `.github/workflows/ci.yml` (install · typecheck · test · build)

## Requires deployment-specific inputs
- [ ] Live clone/full-motion render using the user's consented IDs, assets, and credentials
- [ ] Production self-host boot and smoke render on the target machine
- [ ] Foundation-model training

## Verify
```bash
npm install && npm test && npm run build && npm run dev
```

**Status: governed provider execution code-complete · self-hostable · live account configuration pending.**
