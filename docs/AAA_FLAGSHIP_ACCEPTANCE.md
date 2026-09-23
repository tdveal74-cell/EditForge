# EditForge flagship acceptance contract

This is a release contract, not a score. “AAA” means the evidence below exists
for the release. It does not claim that a subjective design is universally
perfect.

## Experience floor

- The landing page has a five-beat production dossier: invitation, method,
  conform, departments, brief.
- The opening frame uses independent type, still and motion layers. Motion is
  labeled as studio example work.
- Real motion pauses offscreen, honors reduced motion and data saver, and keeps
  user playback control.
- Mobile receives its own composition, touch targets of at least 44 CSS pixels,
  reachable navigation and a non-pinned conform layout.
- Keyboard focus remains visible. Status and error messages use live regions.
- Every rendered button has a state change, dialog, download, navigation or
  server action.

## Canvas and agent floor

- Projects persist through the shared Redis-or-file collection with optimistic
  revision control.
- The Floor Agent uses a real server-side model connection. If absent, it says
  so and never substitutes a scripted answer.
- Agent plans are untrusted creative input. They cannot create receipts,
  completion status, media URLs, consent, canon or master approval.
- Render confirmation binds the exact revision, nodes, prompts and providers.
- Jobs are claimed durably before the provider boundary. Concurrent submits may
  create only one provider request for an idempotency key.
- Generated work stops at human validation. Motion uses an accepted reference.
- Voice work requires a separate authorization checkbox at render time.
- ZIP files remain sealed. Uploads are never extracted or executed.
- A studio cut starts in ingest with rubric false. The model cannot ship it.

## Evidence required before deployment

1. TypeScript, ESLint, Vitest and worker tests pass.
2. The production Next.js build succeeds.
3. Container builds and Compose validation succeed.
4. Desktop, phone, reduced-motion and keyboard browser passes cover landing and
   Canvas primary paths.
5. The merged commit publishes immutable web, worker and provider images.
6. The Hostinger workflow applies that exact twelve-character tag.
7. Live health and primary routes are checked after deployment.

## Configuration dependencies

- `XAI_API_KEY` enables Floor Agent chat, transcription, Grok Imagine stills and
  Grok Imagine motion. `XAI_AGENT_MODEL` defaults to `grok-4.6`.
- `EDITFORGE_ARTIFACT_DIR` is required for uploaded files, generated images and
  provider-returned audio.
- ElevenLabs voice and identity settings remain separate from voice input.
- Production authentication remains fail-closed.
