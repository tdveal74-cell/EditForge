# Zero-Cost Engines

EditForge has three canonical AI-media owners:

- **Persona Engine** — consented voice, avatar, performance transfer, transcription and lip sync.
- **Cinema Engine** — text/image/video generation, references, motion control and shot extension.
- **Edit Engine** — transformation, assembly, captions, compositing and 4K mastering.

`lib/engine-capabilities.ts` is the capability registry. `lib/spend-policy.ts`
is the spending authority. Provider routes may report availability, but only the
spend policy can authorize a paid submission.

## $0 contract

The default environment is fail-closed:

```env
EDITFORGE_SPEND_MODE=zero-cost
EDITFORGE_BILLING_ENABLED=false
EDITFORGE_TOTAL_BUDGET_USD=0
EDITFORGE_SPENT_USD=0
EDITFORGE_PER_JOB_LIMIT_USD=0
```

Adding a provider key does not change that decision. A paid submission requires:

1. `controlled` mode;
2. explicit billing enablement;
3. positive total and per-job ceilings;
4. a server-owned rate configuration;
5. a finite cost estimate inside both ceilings;
6. the existing authentication and idempotency gates.

Runway currently uses `RUNWAY_COST_PER_SECOND_USD`. Browser-supplied estimates
are not trusted. Kling remains adapter-only until its live API request and rate
calculation are implemented and verified.

### Controlled-mode limit

`controlled` mode currently proves server-owned estimation and fail-closed
ceilings for a single submission. It is **not approved for production billing**
until EditForge atomically reserves estimated spend before provider submission,
deduplicates reservations by idempotency key, and reconciles estimated versus
actual cost after completion. Keep deployed environments in `zero-cost` mode
until that ledger is implemented and verified.

## Capability targets

### Persona

- LivePortrait: portrait and expression transfer.
- MuseTalk: audio-driven lip sync.
- Chatterbox: consented voice cloning and TTS.
- Whisper: transcription, captions and alignment.
- HeyGen adapter: hosted avatar, translation and lip sync; paid path disabled.

### Cinema

- LTX: open text/image/video generation path; GPU required.
- Kling target: multi-reference consistency, start/end frames, motion control,
  extension, multimodal editing and native audio.
- Runway target: reference consistency and generative video.

### Edit

- FFmpeg: trim, stitch, transcode, mix, captions and 4K export.
- Remotion: timeline composition, motion graphics and episode batching.
- Runway target: Act-Two performance capture, Aleph-style editing, keyframes,
  video-to-video, background/object editing and upscaling.

## Source surfaces

- Kling 3.0: https://ir.kuaishou.com/news-releases/news-release-details/kling-ai-launches-30-model-ushering-era-where-everyone-can-be/
- Kling motion control: https://app.klingai.com/global/quickstart/motion-control-user-guide
- Runway Gen-4.5: https://runwayml.com/research/introducing-runway-gen-4.5
- Runway Act-Two: https://help.runwayml.com/hc/en-us/articles/42311337895827-Performance-Capture-with-Act-Two
- Runway API: https://docs.dev.runwayml.com/
- LTX: https://github.com/Lightricks/LTX-2

Open software does not make GPU operation free. Chromebook-class devices remain
the control surface; production inference requires a compatible worker.
