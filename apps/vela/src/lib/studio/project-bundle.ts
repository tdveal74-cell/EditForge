import { audioUrl, saveAudio } from "./audio-files";
import { hashMedia, mediaBlob, saveMedia } from "./media-files";
import { isProject, type Project } from "./model";
import { SH135_HASH } from "./media-model";
import { readZip, writeZip } from "./zip-store";

interface SourceEntry { id: string; store: "media" | "booth"; path: string; mime: string; size: number; sha256: string }
interface Manifest { schema: "vela.project-bundle/v1"; project: Project; sources: SourceEntry[] }
const HASH = /^[0-9a-f]{64}$/;

function boothIds(project: Project): string[] {
  return [...new Set([project.likeness?.plateId, ...(project.booth?.takes ?? []).map((take) => take.audioId), ...project.clips.map((clip) => clip.audioId)]
    .filter((id): id is string => typeof id === "string" && !!id))];
}

export async function createProjectBundle(project: Project): Promise<Blob> {
  const sources: SourceEntry[] = [];
  const files: { path: string; blob: Blob }[] = [];
  const mediaSeen = new Set<string>();
  for (const asset of project.media ?? []) {
    if (mediaSeen.has(asset.id)) throw new Error("Duplicate source media ID.");
    mediaSeen.add(asset.id);
    const blob = await mediaBlob(asset.id);
    if (!blob || blob.size !== asset.bytes || await hashMedia(blob) !== asset.sha256) throw new Error(`Missing or changed source: ${asset.name}`);
    const path = `media/${asset.sha256}`;
    sources.push({ id: asset.id, store: "media", path, mime: asset.mime, size: blob.size, sha256: asset.sha256 });
    files.push({ path, blob });
    if (asset.preview && !mediaSeen.has(asset.preview.id)) {
      const proxy = asset.preview;
      const previewBlob = await mediaBlob(proxy.id);
      if (proxy.sourceSha256 !== asset.sha256 || !previewBlob || previewBlob.size !== proxy.bytes || await hashMedia(previewBlob) !== proxy.sha256) throw new Error(`Missing or changed proxy: ${asset.name}`);
      const proxyPath = `media/${proxy.sha256}`;
      sources.push({ id: proxy.id, store: "media", path: proxyPath, mime: proxy.mime, size: proxy.bytes, sha256: proxy.sha256 });
      files.push({ path: proxyPath, blob: previewBlob });
      mediaSeen.add(proxy.id);
    }
  }
  for (const clip of project.clips) if (clip.mediaId && !mediaSeen.has(clip.mediaId)) throw new Error(`Missing source metadata: ${clip.name}`);
  const boothHashes = new Set<string>();
  for (const id of boothIds(project)) {
    const url = await audioUrl(id);
    if (!url) throw new Error("A Booth photo or read is missing. Import it before making a full backup.");
    const blob = await (await fetch(url)).blob();
    const hash = await hashMedia(blob);
    const path = `booth/${hash}`;
    sources.push({ id, store: "booth", path, mime: blob.type, size: blob.size, sha256: hash });
    if (!boothHashes.has(hash)) files.push({ path, blob });
    boothHashes.add(hash);
  }
  const manifest: Manifest = { schema: "vela.project-bundle/v1", project, sources };
  return writeZip([{ path: "project.json", blob: new Blob([JSON.stringify(manifest)], { type: "application/json" }) }, ...files]);
}

export async function restoreProjectBundle(file: Blob): Promise<Project> {
  const entries = await readZip(file);
  const metadata = entries.get("project.json");
  if (!metadata || metadata.size > 8 * 1024 * 1024) throw new Error("Missing or oversized project manifest.");
  const value = JSON.parse(await metadata.text()) as Manifest;
  if (value.schema !== "vela.project-bundle/v1" || !isProject(value.project) || !Array.isArray(value.sources) || value.sources.length > 2000) throw new Error("Invalid Vela project bundle.");
  const declared = new Set(["project.json"]);
  const mediaMap = new Map<string, string>();
  const boothMap = new Map<string, string>();
  const staged: { store: "media" | "booth"; id: string; blob: Blob }[] = [];
  for (const source of value.sources) {
    if (!source || typeof source.sha256 !== "string" || !HASH.test(source.sha256) || typeof source.id !== "string" || source.id.length > 500
      || !["media", "booth"].includes(source.store) || source.path !== `${source.store}/${source.sha256}`
      || typeof source.mime !== "string" || source.mime.length > 200) throw new Error("Invalid source manifest entry.");
    const blob = entries.get(source.path);
    if (!blob || blob.size !== source.size || await hashMedia(blob) !== source.sha256) throw new Error(`Source checksum failed: ${source.path}`);
    declared.add(source.path);
    const mapping = source.store === "media" ? mediaMap : boothMap;
    if (mapping.has(source.id)) throw new Error("Duplicate source ID in backup.");
    const id = `${source.store === "media" ? "media" : "bundle"}-${source.sha256}`;
    mapping.set(source.id, id);
    staged.push({ store: source.store, id, blob: new Blob([blob], { type: source.mime }) });
  }
  if (declared.size !== entries.size) throw new Error("The archive contains unlisted files.");
  const project: Project = structuredClone(value.project);
  for (const asset of project.media ?? []) {
    const source = value.sources.find((entry) => entry.store === "media" && entry.id === asset.id);
    if (!source || asset.sha256 !== source.sha256 || asset.bytes !== source.size) throw new Error("Source metadata does not match the backup.");
    asset.id = mediaMap.get(asset.id)!;
    asset.locked = asset.sha256 === SH135_HASH || asset.locked;
    if (asset.preview) {
      const proxy = value.sources.find((entry) => entry.store === "media" && entry.id === asset.preview!.id);
      if (!proxy || proxy.sha256 !== asset.preview.sha256 || proxy.size !== asset.preview.bytes || asset.preview.sourceSha256 !== asset.sha256) throw new Error("Proxy metadata does not match its source.");
      asset.preview.id = mediaMap.get(asset.preview.id)!;
    }
  }
  for (const clip of project.clips) {
    if (clip.mediaId) {
      const id = mediaMap.get(clip.mediaId);
      if (!id) throw new Error(`Missing media in backup: ${clip.name}`);
      clip.mediaId = id;
    }
    if (clip.audioId) {
      const id = boothMap.get(clip.audioId);
      if (!id) throw new Error(`Missing audio in backup: ${clip.name}`);
      clip.audioId = id;
    }
  }
  if (project.likeness?.plateId) {
    const id = boothMap.get(project.likeness.plateId);
    if (!id) throw new Error("Missing Booth plate in backup.");
    project.likeness.plateId = id;
  }
  for (const take of project.booth?.takes ?? []) if (take.audioId) {
    const id = boothMap.get(take.audioId);
    if (!id) throw new Error("Missing Booth read in backup.");
    take.audioId = id;
  }
  // All checks happen before writes. Content-addressed IDs cannot replace unrelated originals.
  // Metadata is handed to the project store only after every source save succeeds.
  for (const item of staged) {
    if (item.store === "media") await saveMedia(item.id, item.blob);
    else await saveAudio(item.id, item.blob);
  }
  return project;
}

export function downloadBundle(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "vela"}.vela.zip`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
