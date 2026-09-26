# TSWS hybrid production pipeline

The repository now carries a **12-second Episode 1 picture proof plan**. It does
not claim that the 11:17 episode, the definitive script, the approved character
reference packs, or any rendered shot exists. The reference storyboard has a
superseded no-close-up rule; close-ups are allowed and intentionally used in the
later episode work. Its pictured actors are not automatically approved identities.

## Ownership

| Stage | Owner | Gate |
| --- | --- | --- |
| Script and canon | DEVON's authoritative sources and director | Locked revision and exact script hash |
| Shot plan | EditForge TSWS manifest | Valid timebase, IDs, reference pins, episode continuity |
| Faces and wardrobe | Approved Auren and Vespera packs | Human identity selection, rights and consent recorded |
| Voice | Consented voice source, ElevenLabs or local TTS | Named take, review, consent |
| Video plates | OpenArt/Runway or another chosen external service | Per-shot price and second paid confirmation |
| Gold thread, Anahata, reflections | Resolve Fusion or Blender | One canonical effect library, visual QC |
| Sound, color, final edit | Resolve/Fairlight | Protected silence, picture and audio review |
| Job control and archive | EditForge, n8n, storage | Receipts and SHA-256 hashes; no auto-publish |

The current VPS handles job control, transfer and FFmpeg previews. It is not
assumed to have a GPU for open video generation. Provider selection is a
per-shot decision, not a claim that OpenArt/Runway/other APIs are configured in
this repository. EditForge's existing `/api/jobs` billable confirmation and
`/api/edits` DEVON approval boundary stay authoritative.

## Run the opening proof locally

```bash
python3 scripts/tsws_pipeline.py validate tsws/episode-s01e01.json
python3 scripts/tsws_pipeline.py plan tsws/episode-s01e01.json
python3 scripts/tsws_pipeline.py receipt-template tsws/episode-s01e01.json TSWS-S01E01-SH001
```

Generate or photograph each five/seven-second plate externally after the
provider cost is reviewed. Put the source files and completed QC receipts under
a private work directory. A receipt pins the media SHA-256 and records all nine
human QC checks. This CLI never submits a billable request or changes the VFX
board; `plan` produces work orders that can be imported by the existing board or
n8n. Do not mark a shot `done` merely because generation succeeded.

```bash
python3 scripts/tsws_pipeline.py inspect tsws/episode-s01e01.json /private/tsws-work
python3 scripts/tsws_pipeline.py assemble tsws/episode-s01e01.json /private/tsws-work /private/tsws-proof.mp4
```

`assemble` refuses missing, unreviewed, hash-mismatched, short, wrongly sized,
or wrongly timed plates. It creates a **silent picture preview only**. The
final voice, room tone, city ambience, effects, color and VFX are finished in
Resolve. No master is released by this command.

## Folder contract

```text
tsws-work/
  media/TSWS-S01E01-SH001.mp4
  media/TSWS-S01E01-SH002.mp4
  qc/TSWS-S01E01-SH001.json
  qc/TSWS-S01E01-SH002.json
```

Every QC receipt uses `tsws.shot-qc.v1`, contains a relative media path within
the work directory, the content hash, reviewer, timestamp, decision `pass`,
and nine true checks. `plan` gives the cut's IDs, frame spans and briefs.
Approved identity image packs and voice files remain private source media; do
not commit likenesses or credentials to the repository.

## Episode gate before extending the manifest

1. Open the current authoritative Episode 1 script and timed table read.
2. Select the actual Auren and Vespera identity packs and consented voices.
3. Resolve the manifest's three `timelineQuestions`: ending hold, 61.8 percent
   silence versus 07:02 anchor, and the gold thread after its disappearance.
4. Break each story beat into renderable shots, map dialogue takes, and get
   approval for each paid generation with a per-shot ceiling.
5. Ingest and review the plates; assemble a picture cut; finish canonical VFX,
   sound and grade; record the existing EditForge rubric pass before a master.

These questions block a claimed episode master, not the 12-second opening
picture proof. The sample shot briefs are draft direction, not canonical script.
