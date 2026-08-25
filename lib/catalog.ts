import { durableCollection } from "./durable";
import { SAMPLE_STOCK, type StockItem } from "./stock";
import { ASSET_TYPES, isAssetType, type Asset } from "./asset";

/**
 * The two catalogs: owned assets, and licensed stock.
 *
 * Both were hardcoded arrays, so /assets called itself "the index that knows
 * where" while being unable to learn where anything is, and /stock said
 * "license terms travel with the asset" about a list nothing could be added to.
 *
 * Adding is the whole point of an index, so both are writable — and stock
 * refuses an entry with no licence term, which is what makes that sentence true
 * rather than decorative.
 */


function seedAssets(): Asset[] {
  const now = new Date().toISOString();
  return [
    { id: "a1", name: "TSWS_E01_A_cam_master.mov", type: "video", tags: ["master", "e01"], location: "online/cut-01/tsws_e01_cold_open/", addedAt: now },
    { id: "a2", name: "auren_vo_take3.wav", type: "audio", tags: ["vo", "auren"], addedAt: now },
    { id: "a3", name: "restraint_score_bed.wav", type: "audio", tags: ["music"], addedAt: now },
    { id: "a4", name: "still_hold_frame.png", type: "image", tags: ["still", "ending"], addedAt: now },
    // The three files that actually ship in public/media. An index whose first
    // rows are imaginary teaches people not to trust the rest.
    { id: "a-tsws-a", name: "tsws_brand_master_a.mp4", type: "video", tags: ["tsws", "brand", "vertical", "master"], location: "/media/tsws_brand_master_a.mp4", addedAt: now },
    { id: "a-tsws-b", name: "tsws_brand_master_b.mp4", type: "video", tags: ["tsws", "brand", "vertical", "alt"], location: "/media/tsws_brand_master_b.mp4", addedAt: now },
    { id: "a-rain-still", name: "rain_street_still.png", type: "image", tags: ["rain", "night", "reference", "grade"], location: "/media/rain_street_still.png", addedAt: now },
  ];
}

const assets = durableCollection<Asset>({
  key: "editforge:assets",
  file: "assets.json",
  seed: seedAssets,
});

/**
 * Seed rows that no longer exist, and must be cleared from stores already
 * written.
 *
 * `durableCollection` seeds with `SET NX` — the seed runs once, when the
 * collection has never existed, and never again. So editing `seedAssets()`
 * changes nothing for a store that has already been written. When the rain
 * clips were replaced by the TSWS masters, production kept serving
 * `/media/rain_street_night_a.mp4` and `_b.mp4` from KV: two rows in the index
 * whose entire job is knowing where things are, pointing at files that had been
 * deleted from the deployment.
 *
 * The unit test could not have caught it. It runs against a fresh data dir, so
 * it always gets a freshly seeded store and never sees the drift.
 */
const RETIRED_ASSET_IDS = new Set(["a-rain-a", "a-rain-b"]);

export async function listAssets(): Promise<Asset[]> {
  const all = await assets.list();
  // Fast path, and the reason this is safe to run on every read: once the
  // retired rows are gone there is nothing to do and nothing is written.
  if (!all.some((a) => RETIRED_ASSET_IDS.has(a.id))) return all;

  return assets.mutate((rows) => {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (RETIRED_ASSET_IDS.has(rows[i].id)) rows.splice(i, 1);
    }
    // Add the replacements rather than only deleting the dead links, so the
    // index ends up describing the media that is actually there. Repaired in
    // place instead of by bumping the store key, because this catalog is
    // writable — anything an operator added is real data and has to survive.
    for (const row of seedAssets()) {
      if (row.location?.startsWith("/media/") && !rows.some((a) => a.id === row.id)) {
        rows.push(row);
      }
    }
  });
}

export type AddResult<T> = { ok: true; item: T } | { ok: false; reason: string };

export async function addAsset(input: {
  name: string;
  type: string;
  tags?: string[];
  location?: string;
}): Promise<AddResult<Asset>> {
  const name = input.name.trim();
  if (!name) return { ok: false, reason: "An asset needs a filename" };
  if (!isAssetType(input.type)) {
    return { ok: false, reason: `type must be one of ${ASSET_TYPES.join(", ")}` };
  }

  const asset: Asset = {
    id: `a-${slugId(name)}`,
    name,
    type: input.type,
    // Tags are how the index is searched, so blanks are dropped rather than
    // stored as an empty chip nobody can click.
    tags: (input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    location: input.location?.trim() || undefined,
    addedAt: new Date().toISOString(),
  };

  let clash = false;
  await assets.mutate((all) => {
    if (all.some((a) => a.name === name)) {
      clash = true;
      return;
    }
    all.unshift(asset);
  });

  return clash ? { ok: false, reason: `"${name}" is already in the catalog` } : { ok: true, item: asset };
}

export type StockEntry = StockItem & { addedAt: string };

function seedStock(): StockEntry[] {
  const now = new Date().toISOString();
  return SAMPLE_STOCK.map((s) => ({ ...s, addedAt: now }));
}

const stock = durableCollection<StockEntry>({
  key: "editforge:stock",
  file: "stock.json",
  seed: seedStock,
});

export async function listStock(): Promise<StockEntry[]> {
  return stock.list();
}

const STOCK_KINDS = ["music", "sfx", "footage"] as const;

/**
 * Add a stock item.
 *
 * The licence note is required. "License terms travel with the asset — they are
 * filed at archive, not remembered" is only true if an entry cannot exist
 * without one; a blank field here is the licence being remembered instead of
 * filed, which is the failure the sentence describes.
 */
export async function addStock(input: {
  kind: string;
  title: string;
  mood?: string;
  durationSec?: number;
  licenseNote: string;
}): Promise<AddResult<StockEntry>> {
  const title = input.title.trim();
  const licenseNote = input.licenseNote.trim();
  if (!title) return { ok: false, reason: "A stock item needs a title" };
  if (!(STOCK_KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, reason: `kind must be one of ${STOCK_KINDS.join(", ")}` };
  }
  if (!licenseNote) {
    return { ok: false, reason: "A licence term is required — it travels with the asset to archive" };
  }

  const entry: StockEntry = {
    id: `st-${slugId(title)}`,
    kind: input.kind as StockEntry["kind"],
    title,
    durationSec:
      typeof input.durationSec === "number" && Number.isFinite(input.durationSec) && input.durationSec > 0
        ? Math.round(input.durationSec)
        : undefined,
    mood: input.mood?.trim() || "unspecified",
    licenseNote,
    addedAt: new Date().toISOString(),
  };

  let clash = false;
  await stock.mutate((all) => {
    if (all.some((s) => s.id === entry.id)) {
      clash = true;
      return;
    }
    all.unshift(entry);
  });

  return clash ? { ok: false, reason: `"${title}" is already in the library` } : { ok: true, item: entry };
}

/** Stable, readable id fragment. Collisions are caught by the callers above. */
function slugId(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item"
  );
}
