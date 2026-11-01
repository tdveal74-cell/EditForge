# Vela source-cut render worker

This local CLI consumes the **Project + media backup** ZIP that Vela already
exports. It produces a real H.264/AAC MP4 from the original media, plus job
status and a verification receipt. It is the first executable export adapter;
it is not yet wired to Floor, HTTP MCP, or a browser Render button.

```bash
python3 apps/vela/worker/render_bundle.py /path/project.vela.zip \
  /path/new-job-directory --source-cut-review --height 720
```

Python 3.11+, FFmpeg with libx264/AAC, and ffprobe are required. No Python
packages, model credentials, paid generation, network access or container
changes are required. The output parent must exist, and the job directory
must not. An existing job is never overwritten; use a new name for a retry.

## What is rendered

- Original picture/video assets on track 0, selected in the same last-clip
  order as Cut. Gaps are black. Original aspect is contained within the frame.
- Timeline frame rates 24/25/30/50/60, split source offsets and hard cuts.
  Frame-rate conversion holds source frames using their timestamps; it does
  not interpolate movement. Picture spans are validated for exact frame count.
- Original audio on tracks 3–7, and embedded picture audio only where that
  picture is visible. Source offsets, mute, solo, gain and fades are applied.
  A silent picture does not suppress an independent audio lane.
- PNG/JPEG/WebP stills. Original file hashes, including protected SH135, are
  checked before and after rendering. The compressed movie is not byte-identical
  to a source image; originals themselves remain unchanged.
- A stereo 48 kHz audio mix, encoded once to AAC. Sample offsets are integer
  multiples of the supported timebase. Gain/fades update every 64 samples.

The output duration matches Vela's `projectDuration`, including its current
eight-second minimum. Height choices are 360, 720 and 1080; width follows the
project aspect ratio, rounded to an even pixel count.

## Explicit scope

`--source-cut-review` is required because grade, Enhance, Still layers, Stage,
Booth animation and generated score are **not baked**. The receipt lists those
omissions. Titles, captions, demo pictures, synthetic score/Booth timeline
clips and unsupported track layouts are refused instead of silently omitted.
Import a separately rendered audio recording on an audio lane when needed.

This is an 8-bit SDR review export. HDR/wide-gamut sources and non-zero stream
start offsets require an explicit conform first. It is not a lossless repair
master, color-managed final export, true-peak meter, or loudness master.
Premiere, lip-sync, stop/resume, shell geometry and creative approval remain
outside this worker. It makes no change to the grey-coat stopper ruling,
the UNSET resume decision, or SH135.

## Job evidence and recovery

`status.json` moves through validating, rendering_picture, mixing_audio,
verifying, and completed, or records failed/cancelled. SIGTERM/Ctrl-C stops
the child renderer and cleans intermediates. `source-cut-review.mp4` and
`receipt.json` appear only after successful output validation. An interrupted
process killed with SIGKILL can leave temporary files; it cannot overwrite
the source ZIP. Retry into a new directory after inspecting the old status.

The receipt includes the renderer/bundle/output SHA-256, source hashes,
frame count and rate, dimensions, audio intervals and pre-AAC sample peak,
FFmpeg version and probe output. The full movie must decode without errors.
The final audio duration must match the picture within one AAC frame. Audible
sync still requires content-specific review; this metadata check does not
prove lip sync. Overloaded mixes fail instead of being silently limited.
Picture intermediates are hashed around their frame-count validation and
checked again before and after muxing. A changed segment fails the job with
its expected/actual size and hash in `verification-failure.json`; no movie or
success receipt is published and no automatic retry conceals the failure.

Inputs are bounded to 2 GiB per stored-ZIP, 256 MiB per source, 2,000 entries,
500 clips, 40 million source pixels and one hour of timeline. The CLI verifies
paths, inventory, CRC and SHA-256 before invoking FFmpeg. It accepts only local
file/pipe protocols and a fixed set of media demuxers. Each subprocess is
time-bounded. The worker exposes no network port or unauthenticated upload.

## Validation

```bash
python3 -m unittest discover -s apps/vela/worker -p 'test_*.py' -v
```

The synthetic-media tests verify every frame of a 24-to-30 fps split, an audio
marker with source-in and timeline delay (within 2 ms after AAC), fresh output
and overwrite refusal, still import, overlap/solo selection, malformed and
tampered ZIP rejection, source-end limits, unsupported caption/grid rejection,
real CLI cancellation, rejection of a clipping mix, and a validated segment
being truncated both before muxing and after an otherwise successful mux.

A separate smoke run uses the existing browser-exported EP01 test bundle:
SH070 split at frame 100, SH100 starting at frame 181, and the explicitly
labelled test tone from frames 150–270. That produces 421 frames at 30 fps.
This is evidence for export of the existing failed drafts, not repaired or
approved EP01 footage. No original media or rendered test output belongs in git.

### Open reliability finding, 2026-10-20

The intermittent real-source failure has now been reproduced with diagnostics:
the final picture contained only 100 of the expected 421 frames, while audio
continued for the full timeline. In a retained reproduction, the second
picture segment had passed its 81-frame check but was later an incomplete
1,048,624-byte file with no MP4 `moov` index. The first and third segment
hashes matched a successful run. This points to an intermediate changing
after validation; the writer or runtime cause is not established.

The new intermediate identity checks reject such changes before/after muxing
and preserve exact expected/actual evidence. Fault-injection tests cover both
points, including rejection after a complete movie was already muxed. This
hardening is not a claim that the underlying mutation has been fixed.

Successful real-source repeats produced identical MP4 SHA-256
`98344ba0fff479ff4c89e608c05b6bdb4509e9d648010d948c14ea30ada0a81a`.
Sixteen standalone mux repeats with the original duration limit and sixteen
without it passed using retained good segments; removing that limit was not
adopted as a fix. Final frame/rate failures also save the actual probe result.
Keep this worker a review candidate until the mutation is explained and VPS
execution is verified. Passing later repeats does not establish a repair.
