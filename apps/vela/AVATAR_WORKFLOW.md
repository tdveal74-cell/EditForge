# Supplied avatar references and narration

Status: reference import and handoff preparation implemented on this branch. A
photorealistic talking-avatar renderer, verified lip sync, clone synthesis, and
TQO workflow registration are **not implemented by this change**. The live VPS
container is not updated merely by opening this PR.

## Booth

1. Import a `vela.avatar-reference/v1` JSON pack in **Avatar references**.
2. Select a look. The pack's ordered looks and original image bytes are retained;
   imports verify SHA-256 and decoded dimensions before one IndexedDB transaction.
3. Enter the take's transcript, then **Import narration**. Use the exact approved
   episode narration. Import preserves the encoded original and records its hash
   plus decoded sample rate, sample count and duration without quarter-second
   rounding. Import does not establish speaker/clone identity.
4. **Download render handoff** packages that selected photo, original audio and
   current settings. It contains no credentials and submits no job. Its explicit
   state is `prepared`, execution is `not_started`, rendering and registration
   remain false/unset. Missing originals or changed hashes fail instead of
   exporting an apparently complete handoff.

**Download reference pack** includes every look's bytes for another browser.
The general **Download project** command still exports project metadata only;
it is not a media backup. Import the reference pack separately after restoring
project metadata. Stored takes retain imported read metadata, but their audio
must also be transferred separately. Do not claim full-project portability.

The selected original photo is shown unchanged in Booth. Existing synthetic jaw,
blink and fixed-position facial overlays are not applied to imported references.
This avoids representing the legacy amplitude preview as photoreal lip sync.
Enhance/Likeness values are included as requested settings in the handoff; a
renderer still has to apply them and return a reviewed movie.

Limits: 20 JPEG/PNG/WebP looks, 20 MiB each, 100 MiB total decoded source bytes;
40 million pixels per image. Narration is bounded to 50 MiB / ten minutes.
Reference packs contain private photos. Keep them outside public directories
and source control. `production-assets` is excluded from Docker build contexts.

## Terrance selection, 2026-10-20

The user explicitly selected the first **eight**, superseding the first-ten
instruction. These are the first eight returned photo looks in HeyGen's
`TERRANCE ` group `40e9a34642a347e2a925fb5847183d31`. Do not sort by the numbers
embedded in their names.

| Order | Look | HeyGen look ID |
| --- | --- | --- |
| 1 | TQO landscape 3 olive quarter-zip | edbec2e477cff16bad4f492ed6503f35 |
| 2 | TQO landscape 5 gray henley | eb01f2f677d86388ccd802d79741c427 |
| 3 | TQO landscape 7 burgundy sweater | 00e70d803271f164365e8083d138f2b2 |
| 4 | TQO landscape 4 black polo | a27abba9da0539374ced44d6e36f970c |
| 5 | TQO landscape 9 charcoal jacket | 8c2ec0e1bbfcefb006a62795cb2548e0 |
| 6 | TQO landscape 10 tan field jacket | 8687516ceb6fc9a7776b9e63250191be |
| 7 | TQO landscape 6 white oxford | 605b15e1238fd0c2341d742332e5e549 |
| 8 | TQO landscape ref test 1 | 0d52b5d82b0957c7ae083741c9451356 |

All eight retrieved WEBPs are 2752 × 1536. The reusable pack is staged privately
on srv1936199 at
`/opt/vela/production-assets/terrance-first8-20261020/Terrance_First_8.vela-avatar.json`.
Its SHA-256 is `0e987cba480cc0a5ed8b60c8ff30f28264aa3684209e1ae43d520d50acb210f7`.
It contains 8,980,526 original image bytes. Each source hash matches between the
download and VPS copy. No image bytes or signed HeyGen URLs are committed here.

## Remaining TQO integration

The inspected published TQO FINAL V5 is `qEkGOUsNyVaRAmm6`, version
`679ba514-0645-4d53-8e68-d9c41b91ad48`. Re-read its active version before changing
it. Preserve its configured existing ElevenLabs clone; a HeyGen default voice
or a same-name library voice is not an acceptable substitute.

An actual worker must bind the approved episode/segment, target frame rate and
exact episode-audio trim, render the chosen look, and return the artifact and
sync evidence. Verify identity, articulation and start/middle/end AV sync within
one target frame by reviewing the complete take. Vela's current open script MCP
does not control the browser's avatar profile or execute this render.

Only then register a real presenter row with the fields required by live
`Presenter: Attach Clips`: namespaced `episode_row_id`, `segment_index`,
`drive_file_id`, measured `duration_seconds`, `share_verified === true`, and
`voice_track_in_clip === true`. Do not manufacture these flags from an import or
handoff. Build Movie mutes presenter video and uses one authoritative narration
track; preserve that behavior, apply lead padding once and preserve human publish
review. A private reference pack is never a public presenter clip.

## Validation

`npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund` installs the
existing lockfile in this environment. Plain `npm ci` has a pre-existing missing
AJV lock entry; a plain fresh `npm install` encounters an optional Vitest peer
conflict. This change does not silently refresh production dependencies.

- `npm run test:avatar`: reference order/bytes, namespaced IDs, tampering,
  duplicate assets, missing selection, unsupported MIME, dimension/count limits.
- `npm run typecheck` and `npm run build`.
- Actual eight-look pack decoded through the same import validator; eight source
  hashes and original byte counts verified.
- Browser restore/export verification is blocked in this execution environment:
  Chromium launch fails with `socket() failed: Operation not permitted`.
  A build alone does not prove IndexedDB persistence. Run the browser smoke test
  on an authorized host before deploying this branch.
