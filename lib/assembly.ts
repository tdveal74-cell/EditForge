import { NODE01_VO, node01NarrationSeconds, type VoiceLine } from "./masters";
import { shotsInOrder, type Shot } from "./mediaLibrary";
import type { TimelineClip } from "./timeline";

/**
 * The Ascension Caudex, Node 01 — the assembly.
 *
 * /timeline drew `SAMPLE_TIMELINE`: six invented clips with round durations,
 * next to a strip of five real shots that sat in their own band because — as the
 * page said in as many words — "there are five shots and two video clips, so any
 * mapping between them would be invented." That was the right call while the
 * only footage in the building was two brand masters belonging to a different
 * show.
 *
 * It is no longer the situation. Node 01 has five picture masters in documented
 * beat order and eleven narration lines in read order, and an assembly is
 * exactly the object that binds those two facts together. So the timeline stops
 * being a sample.
 *
 * What is measured and what is chosen, stated plainly, because the difference
 * is the whole reliability of the thing:
 *
 *   Measured — the five shots and their order (QC'd and accepted 20 Aug 2026,
 *   "their order is the content"); the eleven lines and their order; every line
 *   runtime, derived from the encoder's own headers in `masters.ts`; and the
 *   45.011s total that falls out of them.
 *
 *   Chosen — `SHOT_LINES` below: which lines play over which shot. Nothing in
 *   the delivery records it. It is an assembly, in the editorial sense: the
 *   first pass that gets picture and track onto one timeline so there is
 *   something to react to. Changing it is a one-line edit and everything
 *   downstream re-times itself, which is the point of deriving the cut rather
 *   than typing out clip start times.
 */

/**
 * Which narration lines play over which shot.
 *
 * Read against the beats: the archivist opens the book (S1) on the two shortest
 * lines, the copy assembles (S2) across the two longest, the close (S3) holds
 * two, the confrontation (S4) carries three — it is the argument, so it takes
 * the most lines — and the dissolution (S5) plays out on the last two.
 */
export const SHOT_LINES: Record<number, number[]> = {
  1: [1, 2],
  2: [3, 4],
  3: [5, 6],
  4: [7, 8, 9],
  5: [10, 11],
};

export type AssembledShot = {
  shot: Shot;
  lines: VoiceLine[];
  startSec: number;
  durationSec: number;
};

/**
 * Lay the narration end to end and hold each shot for the lines assigned to it.
 *
 * Picture follows track rather than the other way round: the lines are already
 * recorded, so their runtimes are fixed and the shot durations are whatever
 * covers them. A shot that ran to its own number would leave a gap or clip a
 * line mid-word.
 */
export function assembleNode01(): AssembledShot[] {
  const byLine = new Map(NODE01_VO.map((l) => [l.line, l]));
  let at = 0;

  return shotsInOrder().map((shot) => {
    const lines = (SHOT_LINES[shot.shot] ?? []).map((n) => {
      const line = byLine.get(n);
      if (!line) throw new Error(`assembly references line L${n}, which is not in NODE01_VO`);
      return line;
    });

    const durationSec = round(lines.reduce((sum, l) => sum + l.durationSec, 0));
    const assembled = { shot, lines, startSec: round(at), durationSec };
    at += durationSec;
    return assembled;
  });
}

/**
 * The assembly as timeline clips — picture on `video`, narration on `vo`.
 *
 * Only the two tracks the material actually fills. `SAMPLE_TIMELINE` carried a
 * score bed, a door latch and room tone because it was a drawing of a timeline;
 * inventing three stems for a cut that has none would put the same fiction back
 * on screen one layer down. The ladder still renders every track — the empty
 * ones now read as work outstanding, which is true.
 */
export function node01Timeline(): TimelineClip[] {
  const clips: TimelineClip[] = [];
  let voAt = 0;

  for (const { shot, lines, startSec, durationSec } of assembleNode01()) {
    clips.push({
      id: shot.id,
      label: shot.label,
      track: "video",
      startSec,
      durationSec,
    });

    for (const line of lines) {
      clips.push({
        id: `vo-l${String(line.line).padStart(2, "0")}`,
        label: `L${String(line.line).padStart(2, "0")}`,
        track: "vo",
        startSec: round(voAt),
        durationSec: line.durationSec,
      });
      voAt += line.durationSec;
    }
  }

  return clips;
}

/**
 * Runtime of the cut.
 *
 * Equal to the narration by construction — the check is that it stays that way.
 * A shot dropped from `SHOT_LINES` would shorten picture while the narration
 * kept its length, and the two numbers would part company.
 */
export function node01Duration(): number {
  return round(assembleNode01().reduce((sum, s) => sum + s.durationSec, 0));
}

/** Every line assigned to exactly one shot, none assigned twice. */
export function assignedLines(): number[] {
  return Object.values(SHOT_LINES).flat().sort((a, b) => a - b);
}

export const NODE01_NARRATION_SEC = node01NarrationSeconds();

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
