import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([
  ".mp4", ".mov", ".webm", ".mkv",
  ".mp3", ".wav", ".m4a",
  ".png", ".jpg", ".jpeg", ".webp",
  ".srt",
]);

export type SourceAsset = {
  name: string;
  uri: string;
  sha256: string;
  byteLength: number;
  modifiedAt: string;
};

export function sourceMediaDir(): string | null {
  const value = process.env.EDITFORGE_SOURCE_MEDIA_DIR?.trim();
  return value ? path.resolve(value) : null;
}

export function sourceCatalogConfigured(): boolean {
  return sourceMediaDir() !== null;
}

function sourceUri(relativeName: string): string {
  const encoded = relativeName.split(path.sep).map(encodeURIComponent).join("/");
  return `editforge-source:///${encoded}`;
}

async function hashFile(filename: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
}

async function walk(root: string, current: string, assets: SourceAsset[]): Promise<void> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const filename = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(root, filename, assets);
      continue;
    }
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const stat = await fs.stat(filename);
    const name = path.relative(root, filename);
    assets.push({
      name,
      uri: sourceUri(name),
      sha256: await hashFile(filename),
      byteLength: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }
}

/** Inventory the private, read-only media mounted into EditForge. */
export async function listSourceAssets(): Promise<SourceAsset[]> {
  const root = sourceMediaDir();
  if (!root) throw new Error("EDITFORGE_SOURCE_MEDIA_DIR is not configured");
  const realRoot = await fs.realpath(root);
  const assets: SourceAsset[] = [];
  await walk(realRoot, realRoot, assets);
  return assets.sort((left, right) => left.name.localeCompare(right.name));
}
