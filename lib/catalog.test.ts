import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data-test-catalog");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { addAsset, addStock, listAssets, listStock } = await import("./catalog");

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "assets.json"), { force: true });
  await fs.rm(path.join(DATA_DIR, "stock.json"), { force: true });
});

describe("asset index", () => {
  it("takes a new entry and keeps it", async () => {
    const res = await addAsset({ name: "B_cam_roll_04.mov", type: "video", tags: ["b-cam"] });
    expect(res.ok).toBe(true);
    expect((await listAssets()).some((a) => a.name === "B_cam_roll_04.mov")).toBe(true);
  });

  it("records where the bytes are — the question the index exists to answer", async () => {
    await addAsset({ name: "x.mov", type: "video", location: "online/cut-01/x/" });
    const asset = (await listAssets()).find((a) => a.name === "x.mov");
    expect(asset?.location).toBe("online/cut-01/x/");
  });

  it("refuses a duplicate filename rather than indexing two rows for one file", async () => {
    await addAsset({ name: "dupe.mov", type: "video" });
    const second = await addAsset({ name: "dupe.mov", type: "video" });
    expect(second.ok).toBe(false);
  });

  it("refuses a type it has no glyph or meaning for", async () => {
    const res = await addAsset({ name: "thing.xyz", type: "hologram" });
    expect(res.ok).toBe(false);
  });

  it("drops blank tags instead of storing a chip nobody can click", async () => {
    await addAsset({ name: "tagged.mov", type: "video", tags: ["Master", "  ", ""] });
    const asset = (await listAssets()).find((a) => a.name === "tagged.mov");
    expect(asset?.tags).toEqual(["master"]);
  });

  it("refuses a nameless asset", async () => {
    expect((await addAsset({ name: "   ", type: "video" })).ok).toBe(false);
  });
});

describe("stock library", () => {
  it("refuses an entry with no licence term", async () => {
    // "License terms travel with the asset — they are filed at archive, not
    // remembered" is only true if an entry cannot exist without one.
    const res = await addStock({ kind: "music", title: "Bed", licenseNote: "  " });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/licence term is required/i);
  });

  it("files an entry that carries its licence", async () => {
    const res = await addStock({
      kind: "sfx",
      title: "Door latch",
      licenseNote: "Clear for social + master",
      durationSec: 2,
    });
    expect(res.ok).toBe(true);
    expect((await listStock()).find((s) => s.title === "Door latch")?.licenseNote).toBe(
      "Clear for social + master"
    );
  });

  it("refuses a kind the library has no lane for", async () => {
    expect((await addStock({ kind: "vfx", title: "x", licenseNote: "y" })).ok).toBe(false);
  });

  it("drops a nonsense duration rather than storing NaN", async () => {
    const res = await addStock({ kind: "music", title: "No length", licenseNote: "ok", durationSec: NaN });
    expect(res.ok).toBe(true);
    expect((await listStock()).find((s) => s.title === "No length")?.durationSec).toBeUndefined();
  });

  it("keeps the seeded library's licence terms intact", async () => {
    for (const item of await listStock()) expect(item.licenseNote.trim()).not.toBe("");
  });
});
