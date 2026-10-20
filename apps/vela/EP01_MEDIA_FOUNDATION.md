# EP01 media foundation

This change replaces the demo-only Cut path with real source-media handling.
It is a foundation for the open EP01 repairs, not an accepted repaired episode.
It is independent of the avatar work in PR #81.

## Implemented

- MP4/MOV/WebM, WAV/OGG/MP3/M4A/FLAC and PNG/JPEG/WebP file import into a
  browser-local media store, with original SHA-256 and original bytes retained.
- Unsupported originals can be retained and linked to a separate browser-playable
  proxy. A proxy is separately hashed and tied to the original hash. Matching
  duration is checked; content/AV-sync approval is not inferred from that check.
  Automatic proxy generation and a server ingest/probe adapter remain open.
- Real video/still playback in Cut; explicit missing-source and decode errors.
  Source video is muted in the picture player; its audio uses the audio path once.
- Selectable 24/25/30/50/60 fps timeline, frame stepping, frame-grid move/trim/split,
  and source in-points that survive a split. Known EP01 stream facts are pinned to
  exact source hashes, not guessed from filenames. Unknown source FPS stays unset.
- Five independent real-media audio lanes, per-clip gain, mute, solo and fade
  controls. These are preview controls; waveform drawing, peak/true-peak meters,
  final sample-accurate mixing and export-sync proof remain open.
- SH135's known hash is tagged as a locked original. This change has no operation
  that overwrites imported source pixels. A future paint/compositor adapter must
  also enforce the lock; the tag alone does not close that future command gate.
- A self-contained, stored-ZIP project/media backup includes originals, linked
  proxies and referenced legacy Booth photos/reads. Restore checks CRC32, SHA-256,
  declared source inventory and bounds before source writes and project import.
  Imported IDs are content-addressed so restoring cannot overwrite unrelated
  sources. A failed source save prevents importing the new project metadata.
- Browser-storage failures produce a persistent unsaved-state warning and leave
  the last successful localStorage value intact. A failed read blocks replacement
  writes. Identical playback state no longer causes repeated identical disk writes.

## Verification

`npm run test:media` runs ten tests covering every frame of the 20,877-frame
timebase, protected frame anchors, 24-to-30 source mapping, source-end bounds,
gain/fade endpoints, ZIP round-trip/tamper/path checks, and failed-save/read safety.
Python's independent `zipfile` reader also verified the emitted ZIP and its CRCs.

The browser smoke test (`scripts/ep01-media-smoke.mjs`) uses a new project clearly
named `EP01 CORE TEST — NOT A REPAIRED CUT` and a separate fresh browser context
for restore. It verifies these real sources:

| Source | Original SHA-256 |
| --- | --- |
| SH070_motion_v01_ORIGINAL_FAILED_DRAFT.mp4 | 0e5710ac6c44d7ed53085ede2fb96700cbf4d296ec525bb070fd812f167fd02b |
| VEO4_SH100_E2b_to_E3_shells_fall.mp4 | 202086b308ebac48a65462371aa9521aa685ec4e1fdf122c3f267fc287e05fd5 |
| SH135_RETAINED_UNCHANGED.png | 0c82b6cfb118ae559e5ab49776dc10551f972fa21df0e5582c044e0d347cb310 |

The test produces half-size VP9/Opus proxies with external FFmpeg from the exact
originals. This is test-fixture preparation, not an automatic in-app proxy service.
The test browser lacks H.264 decode, so this also exercises unsupported-source
retention and proxy linking instead of silently replacing the MP4 originals.
It imports a clearly named test tone, not a character read or a cloned voice.

The test checks real import/stream facts, video playback, 30 fps stepping, split
source offsets, WAV playback across silent SH070 and the SH100 cut, reload,
project-plus-media export, restore in a browser with no previous media database,
all original source hashes after restore, and a forced quota failure that leaves
the previous saved project intact. One measured backup was 16,993,844 bytes.

Run from `apps/vela` with `VELA_TEST_MEDIA_DIR` pointing to those three files.
Set `VELA_TEST_CHROMIUM` when an explicit headless Chromium executable is needed.
Sources/proxies, test backups and screenshots must not be committed.

## ArtCraft check on srv1936199

PhotoCraft CLI 0.10.0 successfully created a 64 × 64 native document, reopened it
with two pixel layers, and exported PNG. Its expected flattening warning was
recorded. FilmCraft CLI 0.9.0 and its actual command registry were read, including
`file.newSequence`'s FPS and audio-track parameters. Later VPS sequence/media
test calls timed out without a usable execution receipt; their completion must be
checked before retrying writes. No FilmCraft conform/export success is claimed.

## Still open / limits

Per-source import is bounded to 256 MiB; image decode is bounded to 40 million
pixels. ZIP backup is limited to 2 GiB, 2,000 entries and 256 MiB per entry, and
accepts this app's stored-ZIP layout only (no ZIP64 or arbitrary compressed ZIP).
The URL cache is bounded to 12 entries. This is not a decoded-frame LRU/proxy farm.

The full 147-asset, 20,877-frame episode has not yet been run through the browser
or exported. Grade/skin are not applied to real-source previews or burned into a
movie by this change. Raster painting, tracking, rotoscoping, shell rigging,
regional temporal repair, named revision history, authenticated project MCP,
worker execution and final export remain open. The SH070 stop, unset resume
decision, SH100 face/shell repair and crowd continuity are unchanged.

PRJ-01/02/06, PIC-06 and SND-01/02 now have concrete implementation and scoped
evidence for review. Keep the full acceptance rows open until their remaining
criteria and the deployed runtime have been verified. No premiere readiness,
creative approval, publishing, source replacement or avatar generation is implied.
