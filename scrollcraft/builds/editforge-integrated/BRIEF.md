# EditForge integrated studio

Self-authored implementation decisions from the current request, opened repository specifications, and opened DEVON EditForge guidance. No invented interview answers. The user explicitly requested Scrollcraft and AAA Flagship UI/UX, specification, and hardware quality.

## Evidence and decisions

1. Vibe: precise, cinematic, tactile, restrained. Existing house colors are navy #0A1628, paper #F8F5F0, and sparse amber #D4A017. The user requested a new site after integrating the Canvas repository.
2. Journey: encounter the image; understand the brief-to-cut workflow; operate a real example; find the appropriate department; enter a project. Sequence is an authored implementation choice.
3. Energy: calm opening, quiet method, one large interactive conform moment, compact department index, resolved working input.
4. Feelings: curiosity, clarity, agency, confidence, readiness. Caused by photographic planes, a plain process, an editable shot sequence, honest module descriptions, and a brief input that opens Canvas.
5. Signature: the Conform Desk. Choose a workflow and scrub its actual ordered sample clips. The displayed frame, cut duration, and launch destination follow the selection. The same template opens in the production Canvas.
6. Aesthetic: premium minimal, grounded in the opened house standard. Dense controls stay in the working module. No glow or decorative blur.
7. Distinct scenes. Native document flow with one sticky working example. No worldflight or scroll hijacking.
8. Assets: imported photographic example plates from the requested repository. They are labeled examples, never customer work or approved studio output. Two compressed excerpts of existing studio media become muted, user-controlled motion studies. They pause offscreen and fall back to posters for reduced motion and data saver. No image generation or paid provider job is needed to build this site.

## Product intent

For Tee and studio operators preparing, generating, reviewing, and finishing media. The visitor should understand that a brief, assets, and review remain connected inside one studio. Primary action: Open Canvas. Other departments remain directly available.

## Feeling curve, written before the score

- Cover: curiosity, from independent overlapping photographic plates beside readable type.
- Method: clarity, from one short sentence for each production responsibility.
- Conform Desk: agency, from selecting a workflow and moving through its real example sequence. This is the peak.
- Departments: confidence, from explicit destinations and truthful purpose labels.
- Close: readiness, from entering a brief and opening the same selected template.

Peak sentence: "I chose a take, moved through its real footage, and opened the production workflow in the studio."
Tell-someone sentence: "It's the site where the example you explore becomes the project you start."
Authored silence: a short, quiet method section before the Conform Desk. No blank screens or empty pinned spans.

## Grammar: production dossier

Constraints: a dimensional cover with media beside type, a quiet method strip, one working example with native controls, an asymmetric department index, and an actual brief input at the close. Compact task navigation is always usable. No full-bleed video hero, no fake dashboard, no repeating feature-card grid, no pinned promotional copy. Working routes open directly on their controls.

Why the other grammars lost: filmic one-shot and continuous world obscure direct department access; chaptered editorial forbids the useful cover media; live surface forbids this requested cinematic cover; typographic poster loses the imagery central to editing; gallery/catalog understates the workflow; split stage repeats the source site; rhythmic cutlist is too hurried for the house tone.

## Layer contract

| Plane      | Content                                     | Motion                       | Relationship                            |
| ---------- | ------------------------------------------- | ---------------------------- | --------------------------------------- |
| Far        | Navy canvas and fine structural rules       | Static                       | Clean ground for type                   |
| Mid        | Wide rooftop example plate                  | Small vertical parallax      | Main image stays intact                 |
| Near       | Portrait/product example plates             | Opposing restrained parallax | Overlap image edges, never the headline |
| Foreground | Semantic frame caption and visible controls | Static                       | Anchors the plates to editing work      |
| Typography | Complete headline and launch action         | Static                       | Always readable                         |

On mobile the copy precedes a shorter, separately composed plate stack. Reduced motion preserves the static layers and all content. There is no WebGL, persistent offscreen video decoding, or canvas raster stretch.

Canvas includes a Micro Drama graph, a live server-backed Floor Agent, microphone transcription, spoken browser replies, durable job receipts, upload storage, output review, and assembly handoff. The agent can propose or request work, but it cannot mint consent, output URLs, acceptance, canon, or final master status.

## Score

| Beat         | Device                 | Why                                           |
| ------------ | ---------------------- | --------------------------------------------- |
| Cover        | flow + parallax        | Depth without a long introduction             |
| Method       | flow + in              | Quiet reading, no dwell                       |
| Conform Desk | pin + bespoke playhead | The working example earns the longest section |
| Departments  | reveal                 | New ground and compact, direct navigation     |
| Close        | flow + native input    | The visitor can begin work                    |

Families: parallax, in, pin, reveal. No consecutive primary family repeats. No scrub video. Target length is about 5 to 6 desktop viewports, governed by content, not a filler quota. The peak is the longest act.

## Fingerprint gate

EditForge Canvas: differs in grammar, navigation, hero, act sequence, close, signature (6/6).
EditForge House: differs in grammar, navigation, hero, act sequence, close, signature (6/6).
Both earlier rows remain unchanged. New row is appended after verification.

## Verification, 2026-09-23

Run against a production build of `main` plus this change, signed in through a
local-only relay, with the skill's harness at 1440x900, 390x844 and reduced
motion. This Chromium has no H.264 decoder, so the relay answered the two
studio clips with VP9 copies of the same frames; posters and stills were real.

What the first pass found, and what changed:

- Both motion posters pointed at `/films/tsws-*.webp`, which were never
  committed; only `.jpg` exists. The hero card and the Conform Desk picture were
  empty panels on every device. Posters now use the `.jpg` files.
- The Conform Desk held 1.35 viewports of pinned scroll while nothing on it
  moved: the promised "scrub its actual ordered sample clips" was only reachable
  by the play button and slider. Scroll now drives the selected take's frame
  through the pinned span (0.0s to 5.9s measured) until the visitor presses play
  or drags the slider, and choosing another take hands it back to scroll.
  Reduced motion and Save-Data leave it manual.
- Both clips re-encoded at native 432x768 with a keyframe every 8 frames
  (was 24) so seeking is immediate.
- Headings joined words on phones ("one frameat a time", "What arewe making?")
  because the mobile CSS hides `<br>` and JSX left no space beside them. Every
  break now carries a real space.

Final pass: no dead scroll at any of the three settings, zero failed requests,
headings read correctly at 390 and 1440, keyboard order runs skip link, nav,
hero, desk controls, departments, close, with a visible focus ring on each.

Not verified: a real phone (iOS video decode, Low Power Mode, touch scrolling),
and H.264 playback itself, which this headless browser cannot decode.

Feel check, written after scrolling cold, then diffed against the curve above:
cover, curious; method, calm and clear; reel, orientation; desk, in control of
the footage (the peak, and now it is the largest change under the wheel); rooms,
confident; close, ready. The reel act is not in the original curve; it reads as
orientation between method and the desk rather than a second peak, so it stays.
