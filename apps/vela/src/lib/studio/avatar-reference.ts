/** Portable supplied-photo references, not a rendered avatar. */
export interface AvatarLook {
  id: string;
  name: string;
  assetId: string;
  sha256: string;
  mime: string;
  width: number;
  height: number;
  source?: { provider: string; lookId: string };
}

export interface AvatarProfile {
  id: string;
  name: string;
  revision: number;
  selectedLookId: string;
  looks: AvatarLook[];
}

export interface AudioReference {
  name: string;
  mime: string;
  sha256: string;
  bytes: number;
  decodedSampleRate: number;
  decodedSamples: number;
  duration: number;
  identityVerified: false;
}

export interface AvatarBundle {
  schema: "vela.avatar-reference/v1";
  profile: AvatarProfile;
  assets: { id: string; mime: string; sha256: string; dataBase64: string }[];
}

export const MAX_AVATAR_BYTES = 100 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const HASH = /^[0-9a-f]{64}$/;
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 500;
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;

export async function sha256(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Validate every asset before the caller commits any project or media mutation. */
export async function decodeAvatarBundle(value: unknown): Promise<{ profile: AvatarProfile; media: { id: string; blob: Blob }[] }> {
  const bundle = value as AvatarBundle | null;
  const p = bundle?.profile;
  if (bundle?.schema !== "vela.avatar-reference/v1" || !p || !text(p.id) || !text(p.name) || !integer(p.revision)
    || !Array.isArray(p.looks) || !p.looks.length || p.looks.length > 20 || !Array.isArray(bundle.assets)
    || bundle.assets.length !== p.looks.length) throw new Error("Invalid avatar reference pack.");
  const ids = new Set<string>();
  const assetIds = new Set<string>();
  const hashes = new Set<string>();
  for (const look of p.looks) {
    if (!look || !text(look.id) || !text(look.name) || !text(look.assetId) || ids.has(look.id) || assetIds.has(look.assetId)
      || typeof look.sha256 !== "string" || !HASH.test(look.sha256) || hashes.has(look.sha256) || !IMAGE_TYPES.has(look.mime)
      || !integer(look.width) || !integer(look.height) || look.width * look.height > 40_000_000
      || (look.source && (!text(look.source.provider) || !text(look.source.lookId)))) throw new Error("Invalid or duplicate avatar look.");
    ids.add(look.id);
    assetIds.add(look.assetId);
    hashes.add(look.sha256);
  }
  if (!ids.has(p.selectedLookId)) throw new Error("The selected look is missing.");
  const seen = new Set<string>();
  const media: { id: string; blob: Blob }[] = [];
  let total = 0;
  for (const asset of bundle.assets) {
    const look = p.looks.find((item) => item.assetId === asset?.id);
    if (!look || seen.has(asset.id) || look.mime !== asset.mime || look.sha256 !== asset.sha256
      || typeof asset.dataBase64 !== "string" || asset.dataBase64.length > 28 * 1024 * 1024
      || !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.dataBase64)) throw new Error("Invalid avatar image payload.");
    const binary = atob(asset.dataBase64);
    total += binary.length;
    if (!binary.length || binary.length > 20 * 1024 * 1024 || total > MAX_AVATAR_BYTES) throw new Error("Avatar images exceed the import limit.");
    const blob = new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))], { type: asset.mime });
    if (await sha256(blob) !== look.sha256) throw new Error(`Image checksum failed: ${look.name}`);
    media.push({ id: `avatar-${look.sha256}`, blob });
    seen.add(asset.id);
  }
  // Content-address local media; an imported ID must never overwrite another asset.
  const profile: AvatarProfile = {
    id: p.id, name: p.name, revision: p.revision, selectedLookId: p.selectedLookId,
    looks: p.looks.map((look) => ({
      id: look.id, name: look.name, assetId: `avatar-${look.sha256}`, sha256: look.sha256,
      mime: look.mime, width: look.width, height: look.height,
      ...(look.source ? { source: { provider: look.source.provider, lookId: look.source.lookId } } : {}),
    })),
  };
  return { profile, media };
}
