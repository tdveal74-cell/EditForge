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

describe("seeded asset locations", () => {
  it("point at files that are actually in public/", async () => {
    // The seed rows carry a `location` under /media, and nothing checked it.
    // When the rain clips were swapped for the TSWS masters, mediaLibrary was
    // caught by its own test and this file was not — the catalog would have
    // gone on advertising two videos that had been deleted, and /assets is
    // the index whose whole job is knowing where things are.
    //
    // Only local paths are checked: an asset can legitimately live in an
    // online store ("online/cut-01/...") or nowhere yet, and neither is a
    // broken link.
    const assets = await listAssets();
    const local = assets.filter((a) => a.location?.startsWith("/"));
    expect(local.length, "no seeded asset points into public/ any more").toBeGreaterThan(0);

    for (const a of local) {
      const file = path.join(process.cwd(), "public", a.location!.replace(/^\//, ""));
      await expect(
        fs.access(file),
        `${a.name} is indexed at ${a.location} but no such file exists`
      ).resolves.toBeUndefined();
    }
  });
});

describe("a store seeded before the media changed", () => {
  it("drops the retired rows and gains their replacements", async () => {
    // The real production state, reproduced: KV was seeded on the first deploy
    // and `SET NX` means it never re-seeds, so it kept serving the rain clips
    // long after they were deleted from the repo. Written straight to the
    // backing file, because going through addAsset would exercise the writer
    // rather than the drift.
    await fs.mkdir(DATA_DIR, { recursive: true });
    const stale = [
      { id: "a-rain-a", name: "rain_street_night_a.mp4", type: "video", tags: [], location: "/media/rain_street_night_a.mp4", addedAt: "2026-08-12T16:24:30.492Z" },
      { id: "a-rain-b", name: "rain_street_night_b.mp4", type: "video", tags: [], location: "/media/rain_street_night_b.mp4", addedAt: "2026-08-12T16:24:30.492Z" },
      // An operator's own row. The repair must not take this with it — that is
      // why the fix retires known ids rather than re-seeding the collection.
      { id: "a-operator", name: "handheld_pickup.mov", type: "video", tags: ["mine"], location: "/media/handheld_pickup.mov", addedAt: "2026-08-20T00:00:00.000Z" },
    ];
    await fs.writeFile(path.join(DATA_DIR, "assets.json"), JSON.stringify(stale, null, 2));

    const after = await listAssets();
    const ids = after.map((a) => a.id);

    expect(ids, "a retired row survived").not.toContain("a-rain-a");
    expect(ids, "a retired row survived").not.toContain("a-rain-b");
    expect(ids, "an operator's own asset was destroyed by the repair").toContain("a-operator");
    expect(ids, "the replacement master was not added").toContain("a-tsws-a");
    expect(ids).toContain("a-tsws-b");
  });

  it("is idempotent — a repaired store is not rewritten", async () => {
    const first = await listAssets();
    const second = await listAssets();
    expect(second).toEqual(first);
  });
});
