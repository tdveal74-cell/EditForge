import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data-test-captions");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { getCaptionCues, saveCaptionCues } = await import("./captionstore");
const { SAMPLE_CUES, cueAtTime, parseCaptionCues } = await import("./captions");

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "captions.json"), { force: true });
});

describe("caption store", () => {
  it("seeds the sample cues", async () => {
    const cues = await getCaptionCues();
    expect(cues.map((c) => c.id)).toEqual(SAMPLE_CUES.map((c) => c.id));
    expect(cues[0].text).toBe("Where are we today?");
  });

  it("keeps an edited cue so reload is not the sample", async () => {
    const edited = SAMPLE_CUES.map((c) =>
      c.id === "c1" ? { ...c, text: "Operator overlay line" } : c
    );
    const saved = await saveCaptionCues(edited);
    expect(saved.ok).toBe(true);
    const loaded = await getCaptionCues();
    expect(loaded[0].text).toBe("Operator overlay line");
  });

  it("refuses an empty list rather than wiping the overlay", async () => {
    const res = await saveCaptionCues([]);
    expect(res.ok).toBe(false);
  });
});

describe("cueAtTime", () => {
  it("returns the cue covering the instant, exclusive of the out point", () => {
    expect(cueAtTime(SAMPLE_CUES, 0)?.text).toBe("Where are we today?");
    expect(cueAtTime(SAMPLE_CUES, 2.5)?.text).toBe("Inside the question we keep avoiding.");
    expect(cueAtTime(SAMPLE_CUES, 10)).toBeNull();
  });
});

describe("parseCaptionCues", () => {
  it("refuses a cue whose end is not after its start", () => {
    const res = parseCaptionCues([{ id: "x", startSec: 3, endSec: 3, text: "nope" }]);
    expect(res.ok).toBe(false);
  });
});
