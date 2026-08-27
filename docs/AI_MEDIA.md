# AI Media — voice and avatar

Both run through the one provider boundary in `lib/providers.ts`. Credentials,
and how to verify them without reading a secret, are in
[`CREDENTIALS.md`](CREDENTIALS.md).

## Voice — ElevenLabs

- UI: `/voice` · plan API: `POST /api/voice/plan` · execution: `POST /api/jobs` with `kind: "voice"`
- Wire: `POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`, key in `xi-api-key`
- Env: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (or `ELEVENLABS_VOICE_ID_<SLUG>` per studio voice), `EDITFORGE_ARTIFACT_DIR`
- Cloned voices: consent and licence required — the runner blocks until it is attached

There is no task to poll. ElevenLabs answers the submit with the audio itself, so
the boundary stores the bytes in the artifact store and records the file as the
job's result. With no artifact store configured, a voice run refuses before
spending rather than paying for audio it would then drop.

## Avatar — HeyGen

- UI: `/avatar` · plan API: `POST /api/avatar/plan` · execution: `POST /api/jobs` with `kind: "avatar"`
- Wire: `POST /v3/videos` then `GET /v3/videos/{id}`, key in `X-Api-Key`
- Env: `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`, `HEYGEN_VOICE_ID` — all three
- Design presets: signal, monochrome, claude, mat, blockframe
- Rubric before master ship

The status envelope nests under `data`; the finished render arrives as
`data.video_url` and is recorded as the job's result.

## Identity-locked work is a different path

Clone voice, full-motion performance and lip-sync against a consented identity do
not run here. They go through DEVON commands into the private adapter, which
enforces the identity registry and per-operation credit ceilings — see
[`DEVON_EXECUTION.md`](DEVON_EXECUTION.md). Separate boundary, separate
credentials, on purpose.
