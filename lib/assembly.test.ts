import { describe, expect, it } from "vitest";
import {
  NODE01_VO,
  NODE01_VO_ALT,
  TSWS_CLIP_BIN,
  node01NarrationSeconds,
  node01VoiceTakes,
  tswsCutIn,
  tswsUnplaced,
  voiceLineSeconds,
} from "./masters";
import {
  SHOT_LINES,
  assembleNode01,
  assignedLines,
  node01Duration,
  node01Timeline,
} from "./assembly";
import { SHOT_SEQUENCE } from "./mediaLibrary";
import { TRACK_ORDER, totalDuration } from "./timeline";

describe("voice line runtimes", () => {
  it("reproduces the one line that was actually read", () => {
    // L07 is the calibration file: its Xing header declares 42 frames, which at
    // 1152 samples and 44.1kHz is 1.097s. If the constants in masters.ts ever
    // drift, this is the number that catches it.
    expect(voiceLineSeconds(34_619)).toBeCloseTo(1.097, 2);
  });

  it("gives byte-identical lines identical runtimes", () => {
    // L06 and L09 are both 81,012 bytes. Constant bitrate plus constant C2PA
    // overhead is the only thing that explains that, and it is the assumption
    // every other duration here rests on.
    const l06 = NODE01_VO.find((l) => l.line === 6)!;
    const l09 = NODE01_VO.find((l) => l.line === 9)!;
    expect(l06.bytes).toBe(l09.bytes);
    expect(l06.durationSec).toBe(l09.durationSec);
  });

  it("gives every line a positive runtime", () => {
    // A line shorter than the fixed overhead would come out negative and
    // silently shorten the cut rather than failing.
    for (const line of node01VoiceTakes()) {
      expect(line.durationSec, `${line.name} has a non-positive runtime`).toBeGreaterThan(0);
    }
  });

  it("numbers the lines 1..11 with no gaps or repeats", () => {
    expect(NODE01_VO.map((l) => l.line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("keeps the alternate take out of the read order", () => {
    // An alternate inside NODE01_VO becomes a twelfth line laid end to end with
    // the rest, which puts a second reading of line 8 into the cut.
    expect(NODE01_VO).not.toContain(NODE01_VO_ALT);
    expect(NODE01_VO.filter((l) => l.line === 8)).toHaveLength(1);
    expect(node01VoiceTakes()).toHaveLength(NODE01_VO.length + 1);
  });

  it("runs 45.011s of narration", () => {
    expect(node01NarrationSeconds()).toBeCloseTo(45.011, 3);
  });
});

describe("the Node 01 assembly", () => {
  it("covers every shot in the sequence", () => {
    expect(assembleNode01()).toHaveLength(SHOT_SEQUENCE.length);
  });

  it("plays the shots in beat order", () => {
    // The order is the content; an assembly that reshuffles it is a different
    // story told with the same frames.
    expect(assembleNode01().map((a) => a.shot.shot)).toEqual([1, 2, 3, 4, 5]);
  });

  it("assigns every line exactly once", () => {
    // A line assigned twice plays twice; a line assigned to nothing is recorded
    // narration that never reaches the cut, and neither shows up as an error.
    expect(assignedLines()).toEqual(NODE01_VO.map((l) => l.line));
  });

  it("leaves no gap or overlap between shots", () => {
    // Picture has to be continuous: a gap is black frames, an overlap is two
    // shots claiming the same second.
    let expected = 0;
    for (const shot of assembleNode01()) {
      expect(shot.startSec).toBeCloseTo(expected, 3);
      expected += shot.durationSec;
    }
  });

  it("holds each shot exactly as long as its lines", () => {
    for (const { shot, lines, durationSec } of assembleNode01()) {
      const lineTotal = lines.reduce((sum, l) => sum + l.durationSec, 0);
      expect(durationSec, `S${shot.shot} does not cover its lines`).toBeCloseTo(lineTotal, 3);
    }
  });

  it("runs exactly as long as the narration", () => {
    // The load-bearing invariant: picture and track are derived from the same
    // eleven runtimes, so if they ever disagree something has been dropped.
    expect(node01Duration()).toBeCloseTo(node01NarrationSeconds(), 3);
  });

  it("refuses an assignment that names a line the studio does not hold", () => {
    const saved = SHOT_LINES[1];
    SHOT_LINES[1] = [1, 99];
    try {
      expect(() => assembleNode01()).toThrow(/L99/);
    } finally {
      SHOT_LINES[1] = saved;
    }
  });
});

describe("the assembly as timeline clips", () => {
  it("puts picture and narration on tracks the ladder knows", () => {
    for (const clip of node01Timeline()) {
      expect(TRACK_ORDER).toContain(clip.track);
    }
  });

  it("carries one video clip per shot and one vo clip per line", () => {
    const clips = node01Timeline();
    expect(clips.filter((c) => c.track === "video")).toHaveLength(SHOT_SEQUENCE.length);
    expect(clips.filter((c) => c.track === "vo")).toHaveLength(NODE01_VO.length);
  });

  it("invents no stems for a cut that has none", () => {
    // The sample timeline carried a score bed, a door latch and room tone. None
    // of them exist; drawing them makes the mix look further along than it is.
    const tracks = new Set(node01Timeline().map((c) => c.track));
    expect([...tracks].sort()).toEqual(["video", "vo"]);
  });

  it("lays the narration end to end with no gaps", () => {
    const vo = node01Timeline().filter((c) => c.track === "vo");
    let expected = 0;
    for (const clip of vo) {
      expect(clip.startSec).toBeCloseTo(expected, 3);
      expected += clip.durationSec;
    }
  });

  it("reports the same total duration the assembly does", () => {
    expect(totalDuration(node01Timeline())).toBeCloseTo(node01Duration(), 3);
  });

  it("keeps clip ids unique", () => {
    const ids = node01Timeline().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the TSWS clip bin", () => {
  it("holds all twenty-nine delivered clips", () => {
    expect(TSWS_CLIP_BIN).toHaveLength(29);
  });

  it("keeps Drive ids and filenames unique", () => {
    // Two rows sharing an id is one clip counted twice, which makes the bin
    // report coverage the studio does not have.
    expect(new Set(TSWS_CLIP_BIN.map((c) => c.fileId)).size).toBe(TSWS_CLIP_BIN.length);
    expect(new Set(TSWS_CLIP_BIN.map((c) => c.name)).size).toBe(TSWS_CLIP_BIN.length);
  });

  it("identifies the two clips already serving from public/media", () => {
    // Matched on exact byte size, which is the only identity check the
    // connector lane affords. Without it the repo's two masters have no
    // provenance and the bin hides two duplicates of what already ships.
    expect(tswsCutIn().map((c) => c.cutInAs).sort()).toEqual([
      "/media/tsws_brand_master_a.mp4",
      "/media/tsws_brand_master_b.mp4",
    ]);
    expect(tswsUnplaced()).toHaveLength(27);
  });

  it("records a real byte size for every clip", () => {
    for (const clip of TSWS_CLIP_BIN) {
      expect(clip.bytes, `${clip.name} has no size`).toBeGreaterThan(0);
    }
  });
});
