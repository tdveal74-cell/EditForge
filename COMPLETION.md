# EditForge — execution completion record

## Definition of done (this repo)
The governed DEVON execution path and the private provider adapter are
code-complete. Studio OS still includes Boards (sample/planner) and Bridges (file handoff).
Live provider readiness remains credential-, identity-, and host-dependent.

### Operational
- [x] Studio department map
- [x] Pipeline, projects, dailies, script
- [x] Timeline, color
- [ ] Audio hierarchy, captions, titles, lane presets, script, pipeline, archive — Boards (sample/planner). They emit files. They are not product editors.
- [x] Assets, review, rubric (saves pass to cut)
- [x] Export, jobs, archive, collab
- [x] Long-form chapters + stitch plan
- [x] Flagship tokens + Nav
- [x] AAA design system: full token ramps, elevation, motion, a11y floor (2026-08-12)
- [x] Shared primitives: Button · Card · Badge · PageHeader
- [x] Hardware reference tier: `lib/hardware.ts` · `/hardware` · `docs/HARDWARE.md`

### AI media
- [x] Voice — ElevenLabs wired end to end: `xi-api-key`, studio-voice → provider-voice resolution, returned bytes stored in the artifact store as the job's result
- [x] Avatar — HeyGen wired end to end: `POST /v3/videos` → `GET /v3/videos/{id}`, `X-Api-Key`, look and voice required before a run is accepted
- [x] Gen video — Runway wired (`text_to_video` / `tasks`, aspect and duration translated and bounded); Kling · Veo · Seedream registered and refusing until implemented
- [x] Control-plane artifact store (`lib/artifacts.ts` + `/api/artifacts/[name]`), content-addressed, audio and video
- [x] One readiness answer across `/api/providers`, `/api/health`, `editforge_status` and the picker: wired · credentialSet · settingsMissing · billable
- [x] Stock licensed index (file-an-asset; Artlist/Epidemic search is not wired)

### Handoff file generators
These are not engines. Each page emits a downloadable file via `/api/handoff`.
- [x] NLE — CMX3600 EDL (picture only; not AAF/XML)
- [x] Mix — stem sheet CSV
- [x] VFX engine — shot package JSON
- [x] MAM — path contract JSON
- [x] Render farm — ffmpeg plan JSON (a plan, not an encode)

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
- [x] honesty labels and live-submit gate

### Governance (2026-08-11)
- [x] `REPOSITORY_STATUS.md`
- [x] `.github/workflows/ci.yml` (install · typecheck · test · build)

## Requires deployment-specific inputs
- [ ] Live clone/full-motion render using the user's consented IDs, assets, and credentials
- [ ] Production self-host boot and smoke render on the target machine
- [ ] Foundation-model training

Credential wiring for every provider above — which variable, on which service,
and how to verify it without reading a secret — is `docs/CREDENTIALS.md`.

## Verify
```bash
npm install && npm test && npm run build && npm run dev
```

**Status: DEVON provider execution is code-complete. Studio surfaces still include Boards and Bridges. Not a finished AAA NLE. Live account configuration pending.**
