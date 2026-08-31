import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data-test-audiolaw");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { getAudioLaw, saveAudioLaw } = await import("./audiostore");
const { AUDIO_HIERARCHY } = await import("./audio");

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "audio-law.json"), { force: true });
});

describe("audio law store", () => {
  it("seeds the sample ladder", async () => {
    const levels = await getAudioLaw();
    expect(levels.map((l) => l.track)).toEqual(AUDIO_HIERARCHY.map((l) => l.track));
    expect(levels[0].name).toBe("VO / dialogue");
  });

  it("keeps an edited stem name so mix can realise it", async () => {
    const edited = AUDIO_HIERARCHY.map((l) =>
      l.track === "vo" ? { ...l, name: "Operator VO stem", rule: "Keep the question audible" } : l
    );
    const saved = await saveAudioLaw(edited);
    expect(saved.ok).toBe(true);
    const loaded = await getAudioLaw();
    expect(loaded[0].name).toBe("Operator VO stem");
    expect(loaded[0].rule).toBe("Keep the question audible");
    expect(loaded[0].track).toBe("vo");
  });

  it("refuses a three-stem ladder rather than letting mix drop ambience", async () => {
    const res = await saveAudioLaw(AUDIO_HIERARCHY.slice(0, 3));
    expect(res.ok).toBe(false);
  });
});
