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
    { id: "a-rain-a", name: "rain_street_night_a.mp4", type: "video", tags: ["rain", "night", "vertical", "master"], location: "/media/rain_street_night_a.mp4", addedAt: now },
    { id: "a-rain-b", name: "rain_street_night_b.mp4", type: "video", tags: ["rain", "night", "vertical", "alt"], location: "/media/rain_street_night_b.mp4", addedAt: now },
    { id: "a-rain-still", name: "rain_street_still.png", type: "image", tags: ["rain", "night", "reference", "grade"], location: "/media/rain_street_still.png", addedAt: now },
  ];
}

const assets = durableCollection<Asset>({
  key: "editforge:assets",
  file: "assets.json",
  seed: seedAssets,
});

export async function listAssets(): Promise<Asset[]> {
  return assets.list();
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
