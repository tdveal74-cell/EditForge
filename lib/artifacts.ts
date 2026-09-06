import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * The control plane's own artifact store.
 *
 * Some providers do not hand back a URL. ElevenLabs answers a text-to-speech
 * POST with the audio bytes themselves — there is no task to poll and no link
 * to record — so a studio that has nowhere to put bytes cannot run voice at
 * all. That was the actual reason the live voice path stayed unimplemented,
 * and it is a storage problem rather than an API-shape one.
 *
 * This is the storage. It is the same directory the render worker already
 * writes into (`EDITFORGE_ARTIFACT_DIR`, a shared volume in `compose.yaml`),
 * served back through `/api/artifacts/[name]` behind the same authentication
 * as everything else.
 *
 * Names are content-addressed. A retried submit that produces identical bytes
 * lands on the same filename rather than accumulating near-duplicates, and the
 * hash in the name is the same hash the DEVON receipt path records.
 */

/** Extensions the store will hold, and therefore that the route will serve. */
export const ARTIFACT_EXTENSIONS = [
  "mp4",
  "mov",
  "webm",
  "mp3",
  "wav",
  "m4a",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "zip",
  "md",
  "txt",
  "json",
  "pdf",
  "srt",
  "vtt",
  "csv",
  "mkv",
  "avi",
  "m4v",
  "mpeg",
  "mpg",
  "flac",
  "ogg",
  "aac",
  "aiff",
  "aif",
  "opus",
  "wma",
  "caf",
  "amr",
  "wmv",
  "3gp",
  "3g2",
  "mts",
  "m2ts",
  "ts",
  "tif",
  "tiff",
  "psd",
  "exr",
  "dpx",
  "heic",
  "heif",
  "svg",
] as const;

const ARTIFACT_NAME = new RegExp(
  `^[A-Za-z0-9._-]+\\.(${ARTIFACT_EXTENSIONS.join("|")})$`,
);

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".zip": "application/zip",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".srt": "text/plain; charset=utf-8",
  ".vtt": "text/vtt",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
  ".aiff": "audio/aiff",
  ".opus": "audio/ogg",
  ".m4v": "video/mp4",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
};

/** The configured store directory, or null when the studio has none. */
export function artifactDir(): string | null {
  const dir = process.env.EDITFORGE_ARTIFACT_DIR?.trim();
  return dir ? dir : null;
}

/**
 * Whether bytes returned by a provider have somewhere to live.
 *
 * Reported by `/api/health` and `/api/providers` so a voice submit that would
 * refuse says so before anyone clicks Run, rather than after a provider has
 * already been paid for audio the studio then throws away.
 */
export function artifactStoreConfigured(): boolean {
  return artifactDir() !== null;
}

/** True for a name this store would accept and the route would serve. */
export function isArtifactName(name: string): boolean {
  return name === path.basename(name) && ARTIFACT_NAME.test(name);
}

export function contentTypeForArtifact(name: string): string {
  return (
    CONTENT_TYPES[path.extname(name).toLowerCase()] ??
    "application/octet-stream"
  );
}

/**
 * Where a stored artifact is readable from.
 *
 * Relative by default, because the browser that opened the studio is the thing
 * that follows the link. An absolute base is only needed when something outside
 * the browser session — the render worker, a webhook — has to resolve it.
 */
export function artifactUrl(name: string): string {
  const base = (
    process.env.EDITFORGE_ARTIFACT_BASE_URL?.trim() ||
    (process.env.EDITFORGE_PUBLIC_URL?.trim()
      ? `${process.env.EDITFORGE_PUBLIC_URL.trim().replace(/\/$/, "")}/api/artifacts`
      : "/api/artifacts")
  ).replace(/\/$/, "");
  return `${base}/${encodeURIComponent(name)}`;
}

export type StoredArtifact = {
  name: string;
  url: string;
  sha256: string;
  byteLength: number;
  contentType: string;
};

/** Strip anything the store's own name rule would reject. */
function safeSegment(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

/**
 * Persist provider bytes and return how to reach them.
 *
 * Throws rather than returning a partial result: a caller that has already
 * spent money on these bytes needs to know they were not kept.
 */
export async function storeArtifact(input: {
  bytes: ArrayBuffer | Uint8Array;
  extension: string;
  prefix: string;
}): Promise<StoredArtifact> {
  const dir = artifactDir();
  if (!dir) throw new Error("EDITFORGE_ARTIFACT_DIR is not configured");

  const body =
    input.bytes instanceof Uint8Array
      ? input.bytes
      : new Uint8Array(input.bytes);
  if (body.byteLength === 0)
    throw new Error("provider returned an empty artifact");

  const extension = input.extension.startsWith(".")
    ? input.extension.toLowerCase()
    : `.${input.extension.toLowerCase()}`;
  const sha256 = createHash("sha256").update(body).digest("hex");
  const name = `${safeSegment(input.prefix, "artifact")}-${sha256.slice(0, 16)}${extension}`;
  if (!isArtifactName(name))
    throw new Error(`refusing to store an unservable artifact name: ${name}`);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), body);

  return {
    name,
    url: artifactUrl(name),
    sha256,
    byteLength: body.byteLength,
    contentType: contentTypeForArtifact(name),
  };
}
