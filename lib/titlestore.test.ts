import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data-test-titles");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { getTitleCards, saveTitleCards } = await import("./titlestore");
const { SAMPLE_TITLE_CARDS, typedPrefix, parseTitleCards } = await import("./titles");

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "titles.json"), { force: true });
});

describe("title store", () => {
  it("seeds the sample cards", async () => {
    const cards = await getTitleCards();
    expect(cards.map((c) => c.id)).toEqual(SAMPLE_TITLE_CARDS.map((c) => c.id));
    expect(cards[0].text).toBe("The Shadow We Share");
  });

  it("keeps an edited card so reload is not the sample", async () => {
    const edited = SAMPLE_TITLE_CARDS.map((c) =>
      c.id === "t1" ? { ...c, text: "Operator type-on" } : c
    );
    const saved = await saveTitleCards(edited);
    expect(saved.ok).toBe(true);
    const loaded = await getTitleCards();
    expect(loaded[0].text).toBe("Operator type-on");
  });

  it("refuses an empty list", async () => {
    expect((await saveTitleCards([])).ok).toBe(false);
  });
});

describe("typedPrefix", () => {
  it("types the string by progress rather than showing the whole card at once", () => {
    expect(typedPrefix("SHADOW", 0)).toBe("");
    expect(typedPrefix("SHADOW", 0.5)).toBe("SHA");
    expect(typedPrefix("SHADOW", 1)).toBe("SHADOW");
  });
});

describe("parseTitleCards", () => {
  it("refuses a card with no duration", () => {
    const res = parseTitleCards([{ ...SAMPLE_TITLE_CARDS[0], durationSec: 0 }]);
    expect(res.ok).toBe(false);
  });
});
