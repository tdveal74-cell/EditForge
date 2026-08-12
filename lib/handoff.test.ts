import { describe, expect, it } from "vitest";
import {
  LOUDNESS_TARGETS,
  buildEDL,
  buildPathContract,
  buildShotPackage,
  buildStemSheet,
  toFrames,
  toTimecode,
} from "./handoff";
import { SAMPLE_TIMELINE, type TimelineClip } from "./timeline";

const clips: TimelineClip[] = [
  { id: "v1", label: "A-cam cold open", track: "video", startSec: 0, durationSec: 12 },
  { id: "v2", label: "Still hold", track: "video", startSec: 12, durationSec: 3 },
  { id: "vo1", label: "Auren VO", track: "vo", startSec: 1, durationSec: 10 },
];

describe("timecode", () => {
  it("counts frames, not decimals", () => {
    expect(toTimecode(0, 25)).toBe("00:00:00:00");
    expect(toTimecode(1, 25)).toBe("00:00:01:00");
    expect(toTimecode(1.5, 25)).toBe("00:00:01:12");
  });

  it("rolls frames into seconds at the timebase, not at 30", () => {
    // The classic bug: hardcoding 30. At 25fps frame 24 is the last frame of
    // the second, and an EDL that says 00:00:00:26 is not a timecode at all.
    expect(toTimecode(0.96, 25)).toBe("00:00:00:24");
    expect(toTimecode(1.0, 25)).toBe("00:00:01:00");
    expect(toTimecode(1, 24)).toBe("00:00:01:00");
    expect(toTimecode(23 / 24, 24)).toBe("00:00:00:23");
  });

  it("names the frame that contains the moment, not the one after it", () => {
    // At 25fps frame 38 spans 1.52s–1.56s, so 1.5s is frame 37. Rounding would
    // push every clip boundary one frame late — a black flash at each cut.
    expect(toTimecode(1.5, 25)).toBe("00:00:01:12");
    expect(toFrames(1.5, 25)).toBe(37);
  });

  it("absorbs float drift so a whole-second duration is not a frame short", () => {
    // 0.1 * 3 is 0.30000000000000004; the reverse case, a 3.0 that arrives a
    // hair under, must still be 75 frames at 25fps rather than 74.
    expect(toFrames(2.9999999999999996, 25)).toBe(75);
    expect(toFrames(3, 25)).toBe(75);
  });

  it("carries minutes and hours", () => {
    expect(toTimecode(60, 24)).toBe("00:01:00:00");
    expect(toTimecode(3600, 24)).toBe("01:00:00:00");
    expect(toTimecode(3725.5, 24)).toBe("01:02:05:12");
  });

  it("wraps at 24 hours, as timecode does", () => {
    expect(toTimecode(86400, 25)).toBe("00:00:00:00");
    expect(toTimecode(86401, 25)).toBe("00:00:01:00");
  });

  it("never emits a negative or NaN field", () => {
    // A media element reports NaN duration before it loads; a clip dragged
    // before zero reports negative. Either would render as "NaN:NaN:NaN:NaN"
    // in a file an assistant then has to debug by eye.
    expect(toTimecode(-5, 25)).toBe("00:00:00:00");
    expect(toTimecode(NaN, 25)).toBe("00:00:00:00");
    expect(toFrames(NaN, 25)).toBe(0);
  });
});

describe("EDL", () => {
  const edl = buildEDL({ title: "Cold open", clips, fps: 25 });

  it("declares its frame count mode, because a reader cannot infer it", () => {
    expect(edl).toContain("FCM: NON-DROP FRAME");
    expect(edl).toContain("* TIMEBASE: 25 FPS");
  });

  it("numbers events from 001 in record order", () => {
    const events = edl.split("\n").filter((l) => /^\d{3} /.test(l));
    expect(events).toHaveLength(2);
    expect(events[0].startsWith("001")).toBe(true);
    expect(events[1].startsWith("002")).toBe(true);
  });

  it("orders events by record time even when the clips are not", () => {
    const shuffled = [clips[1], clips[0]];
    const out = buildEDL({ title: "T", clips: shuffled, fps: 25 });
    const recIns = out
      .split("\n")
      .filter((l) => /^\d{3} /.test(l))
      .map((l) => l.trim().split(/\s+/).slice(-2)[0]);
    expect(recIns).toEqual(["00:00:00:00", "00:00:12:00"]);
  });

  it("makes each record-out the next record-in on a butt-cut", () => {
    // A conform that leaves a one-frame hole between two adjacent events shows
    // as a black flash in the master, and it is the reason record continuity is
    // the first thing an assistant checks.
    const rows = edl
      .split("\n")
      .filter((l) => /^\d{3} /.test(l))
      .map((l) => l.trim().split(/\s+/));
    expect(rows[0].slice(-1)[0]).toBe(rows[1].slice(-2)[0]);
  });

  it("carries picture only and says so", () => {
    expect(edl).toContain("PICTURE ONLY");
    expect(edl).not.toContain("Auren VO");
  });

  it("names every event's source clip", () => {
    expect(edl).toContain("* FROM CLIP NAME: A-cam cold open");
    expect(edl).toContain("* FROM CLIP NAME: Still hold");
  });

  it("keeps a newline in a title or clip name from forging a record", () => {
    const out = buildEDL({
      title: "Bad\nTITLE: Forged",
      clips: [{ id: "x", label: "Line\n001  AX  V  C  x", track: "video", startSec: 0, durationSec: 1 }],
      fps: 25,
    });
    expect(out.split("\n").filter((l) => l.startsWith("TITLE:"))).toHaveLength(1);
    expect(out.split("\n").filter((l) => /^\d{3} /.test(l))).toHaveLength(1);
  });

  it("says there are no picture events rather than emitting an empty file", () => {
    const out = buildEDL({ title: "Audio only", clips: [clips[2]], fps: 25 });
    expect(out).toContain("* NO PICTURE EVENTS");
  });

  it("drops a zero-length clip instead of writing an event that starts and ends together", () => {
    const out = buildEDL({
      title: "T",
      clips: [{ id: "z", label: "Zero", track: "video", startSec: 0, durationSec: 0 }],
      fps: 25,
    });
    expect(out).toContain("* NO PICTURE EVENTS");
  });
});

describe("stem sheet", () => {
  const target = LOUDNESS_TARGETS[0];
  const sheet = buildStemSheet({ title: "Cold open", clips: SAMPLE_TIMELINE, target });

  it("has a row per level of the ladder, in ladder order", () => {
    const rows = sheet.split("\n").filter((l) => l && !l.startsWith("#"));
    expect(rows).toHaveLength(5); // header + four levels
    expect(rows[1]).toContain("VO / dialogue");
    expect(rows[4]).toContain("Ambience");
  });

  it("counts the clips actually on each track", () => {
    const vo = sheet.split("\n").find((l) => l.startsWith("VO / dialogue"))!;
    expect(vo.split(",")[4]).toBe("1");
    expect(vo.split(",")[5]).toBe("10.00");
  });

  it("puts the programme target on the dialogue anchor only", () => {
    // A music bed printed at the dialogue anchor is by definition competing
    // with the voice — the ladder's whole first rule.
    const lines = sheet.split("\n");
    expect(lines.find((l) => l.startsWith("VO / dialogue"))).toContain("-16");
    expect(lines.find((l) => l.startsWith("Music bed"))).toContain("no independent target");
  });

  it("quotes a field containing a comma so the row does not gain a column", () => {
    const rows = sheet.split("\n").filter((l) => l && !l.startsWith("#"));
    for (const row of rows) {
      // Every row must parse to the same column count as the header.
      expect(countCsvColumns(row)).toBe(countCsvColumns(rows[0]));
    }
  });
});

describe("shot package", () => {
  const pkg = JSON.parse(buildShotPackage({ title: "Cold open", clips, fps: 25, colorSpace: "ACEScct" }));

  it("gives frames, not seconds — a compositor works in frames", () => {
    expect(pkg.shots[0].firstFrame).toBe(0);
    expect(pkg.shots[0].lastFrameExclusive).toBe(300);
    expect(pkg.shots[0].frameCount).toBe(300);
  });

  it("states which end of the range is exclusive rather than leaving it to convention", () => {
    expect(pkg.frameRangeConvention).toMatch(/exclusive/);
  });

  it("leaves no frame gap between adjacent shots", () => {
    expect(pkg.shots[1].firstFrame).toBe(pkg.shots[0].lastFrameExclusive);
  });

  it("numbers shots in tens so an insert can be added without renumbering", () => {
    expect(pkg.shots[0].shotId).toBe("cold_open_0010");
    expect(pkg.shots[1].shotId).toBe("cold_open_0020");
  });

  it("carries the plate colour space the comp must conform to", () => {
    expect(pkg.colorSpace).toBe("ACEScct");
    expect(pkg.shots[0].colorSpace).toBe("ACEScct");
  });

  it("carries the VFX board so a compositor sees what is already someone's work", () => {
    const withBoard = JSON.parse(
      buildShotPackage({
        title: "Cold open",
        clips,
        fps: 25,
        colorSpace: "ACEScct",
        board: [{ id: "VFX_020", desc: "Particulate", status: "wip", engine: "Fusion" }],
      })
    );
    expect(withBoard.board).toHaveLength(1);
    expect(withBoard.board[0].status).toBe("wip");
  });

  it("omits the board rather than sending an empty one", () => {
    // An empty array reads as "the board is clear", which is a different claim
    // from "no board was consulted".
    expect(pkg.board).toBeUndefined();
    const empty = JSON.parse(
      buildShotPackage({ title: "T", clips, fps: 25, colorSpace: "ACEScct", board: [] })
    );
    expect(empty.board).toBeUndefined();
  });
});

describe("path contract", () => {
  const contract = JSON.parse(buildPathContract({ cutId: "cut-abc", title: "Cold Open" }));

  it("names three tiers separately — one path cannot say where a master is", () => {
    expect(Object.keys(contract.tiers)).toEqual(["online", "nearline", "archive"]);
  });

  it("is deterministic from the cut, so every surface resolves the same path", () => {
    const again = JSON.parse(buildPathContract({ cutId: "cut-abc", title: "Cold Open" }));
    expect(again).toEqual(contract);
    expect(contract.tiers.online.path).toBe("online/cut-abc/cold_open/");
  });

  it("still produces a usable key for a title with nothing sluggable in it", () => {
    const odd = JSON.parse(buildPathContract({ cutId: "cut-9", title: "—" }));
    expect(odd.tiers.archive.path).toBe("archive/cut-9/cut_9/");
  });
});

/** Column count that respects quoting, so the assertion tests what CSV means. */
function countCsvColumns(row: string): number {
  let cols = 1;
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) cols++;
  }
  return cols;
}
