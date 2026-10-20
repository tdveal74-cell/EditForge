import { SH135_HASH, SOURCE_FACTS, type MediaAsset } from "./media-model";

const cache = new Map<string, string>();
const MAX_FILE = 256 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("vela-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("sources");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function mediaBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction("sources", "readonly");
      const request = tx.objectStore("sources").get(id);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function saveMedia(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sources", "readwrite");
      tx.objectStore("sources").put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("The media save was aborted."));
    });
  } finally { db.close(); }
}

/** Bounded URL cache; the browser streams video instead of retaining decoded frame arrays. */
export async function mediaUrl(id: string): Promise<string> {
  const hit = cache.get(id);
  if (hit) { cache.delete(id); cache.set(id, hit); return hit; }
  const blob = await mediaBlob(id);
  if (!blob) throw new Error("Source media is missing. Import the original file again.");
  const url = URL.createObjectURL(blob);
  cache.set(id, url);
  while (cache.size > 12) {
    const oldest = cache.keys().next().value!;
    URL.revokeObjectURL(cache.get(oldest)!);
    cache.delete(oldest);
  }
  return url;
}

export async function hashMedia(blob: Blob): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))]
    .map((n) => n.toString(16).padStart(2, "0")).join("");
}

function mediaKind(file: File): MediaAsset["kind"] {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp"].includes(ext ?? "")) return "image";
  if (["wav", "ogg", "mp3", "m4a", "flac"].includes(ext ?? "")) return "audio";
  if (["mp4", "mov", "webm"].includes(ext ?? "")) return "video";
  throw new Error("Choose MP4/MOV/WebM, WAV/OGG/MP3/M4A/FLAC, or PNG/JPEG/WebP.");
}

export async function importMedia(file: File): Promise<MediaAsset> {
  if (!file.size || file.size > MAX_FILE) throw new Error("Choose media smaller than 256 MB. Larger sources need a proxy first.");
  const kind = mediaKind(file);
  const hash = await hashMedia(file);
  const facts = SOURCE_FACTS[hash];
  const asset: MediaAsset = { id: `media-${hash}`, name: file.name, mime: file.type || "application/octet-stream",
    kind, bytes: file.size, sha256: hash, duration: facts?.duration ?? null, sourceFps: facts?.fps ?? null,
    ...(facts ? { width: facts.width, height: facts.height } : {}), browserPlayable: true,
    hasAudio: kind === "audio" ? true : kind === "image" ? false : (facts?.hasAudio ?? null), locked: hash === SH135_HASH };
  if (kind === "image") {
    const image = await createImageBitmap(file);
    asset.width = image.width; asset.height = image.height; image.close();
    if (asset.width * asset.height > 40_000_000) throw new Error("This image is too large for the browser editor.");
  } else {
    const url = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const media = document.createElement(kind === "video" ? "video" : "audio");
        const finish = (error?: Error) => { clearTimeout(timer); media.removeAttribute("src"); media.load(); if (error) reject(error); else resolve(); };
        const timer = setTimeout(() => finish(new Error("Media metadata timed out. Create a browser-playable proxy.")), 15000);
        media.preload = "metadata";
        media.onloadedmetadata = () => {
          if (!Number.isFinite(media.duration) || media.duration <= 0) return finish(new Error("This codec needs a browser-playable proxy."));
          asset.duration = media.duration;
          if (media instanceof HTMLVideoElement) { asset.width = media.videoWidth; asset.height = media.videoHeight; }
          finish();
        };
        media.onerror = () => finish(new Error("This browser cannot decode the file. The original has not been changed."));
        media.src = url;
      });
    } catch {
      // Keep unsupported originals. A linked, playable proxy enables preview later.
      asset.browserPlayable = false;
    } finally { URL.revokeObjectURL(url); }
  }
  await saveMedia(asset.id, file);
  return asset;
}

export async function attachPreview(file: File, source: MediaAsset): Promise<MediaAsset> {
  if (source.kind === "image") throw new Error("Still images do not need video proxies.");
  const proxy = await importMedia(file);
  if (proxy.id === source.id) throw new Error("That is the original file. Choose a separate preview proxy.");
  if (!proxy.browserPlayable || !proxy.duration || proxy.kind !== source.kind) throw new Error("Choose a playable proxy of the same media type.");
  if (source.duration && Math.abs(proxy.duration - source.duration) > Math.max(0.05, 1 / (source.sourceFps ?? 24))) throw new Error("Proxy duration does not match the original. Use a full-length proxy with the same start time.");
  return { ...source, duration: source.duration ?? proxy.duration, preview: {
    id: proxy.id, sha256: proxy.sha256, bytes: proxy.bytes, mime: proxy.mime, duration: proxy.duration, sourceSha256: source.sha256,
  } };
}
