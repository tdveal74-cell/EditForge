export type FrameRate = 24 | 25 | 30 | 50 | 60;
export type Track = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface MediaAsset {
  id: string;
  name: string;
  mime: string;
  kind: "video" | "audio" | "image";
  bytes: number;
  sha256: string;
  duration: number | null;
  width?: number;
  height?: number;
  sourceFps: number | null;
  hasAudio: boolean | null;
  locked: boolean;
  browserPlayable?: boolean;
  preview?: { id: string; sha256: string; bytes: number; mime: string; duration: number; sourceSha256: string };
}

export const SH135_HASH = "0c82b6cfb118ae559e5ab49776dc10551f972fa21df0e5582c044e0d347cb310";
export const SOURCE_FACTS: Record<string, { fps: number; hasAudio: boolean; duration: number; width: number; height: number }> = {
  "0e5710ac6c44d7ed53085ede2fb96700cbf4d296ec525bb070fd812f167fd02b": { fps: 24, hasAudio: false, duration: 145 / 24, width: 1264, height: 720 },
  "202086b308ebac48a65462371aa9521aa685ec4e1fdf122c3f267fc287e05fd5": { fps: 24, hasAudio: true, duration: 8, width: 1920, height: 1080 },
};

export function isMediaAsset(value: unknown): value is MediaAsset {
  if (!value || typeof value !== "object") return false;
  const a = value as MediaAsset;
  const hash = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
  const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
  const bytes = (v: unknown) => positive(v) && Number.isSafeInteger(v) && v <= 256 * 1024 * 1024;
  if (!hash(a.sha256) || a.id !== `media-${a.sha256}` || typeof a.name !== "string" || a.name.length > 500
    || typeof a.mime !== "string" || a.mime.length > 200 || !["video", "audio", "image"].includes(a.kind)
    || !bytes(a.bytes) || !(a.duration === null || positive(a.duration)) || !(a.sourceFps === null || positive(a.sourceFps))
    || !(a.hasAudio === null || typeof a.hasAudio === "boolean") || typeof a.locked !== "boolean"
    || (a.browserPlayable !== undefined && typeof a.browserPlayable !== "boolean")
    || (a.width !== undefined && !positive(a.width)) || (a.height !== undefined && !positive(a.height))) return false;
  const p = a.preview;
  return p === undefined || (!!p && hash(p.sha256) && p.id === `media-${p.sha256}` && bytes(p.bytes)
    && typeof p.mime === "string" && p.mime.length <= 200 && positive(p.duration) && p.sourceSha256 === a.sha256);
}

export function snapTime(seconds: number, fps: FrameRate): number {
  if (!Number.isFinite(seconds)) throw new Error("Time must be finite.");
  return Math.max(0, Math.round(seconds * fps)) / fps;
}

export function frameAt(seconds: number, fps: number): number {
  if (!Number.isFinite(seconds) || !Number.isFinite(fps) || fps <= 0) throw new Error("Invalid frame timebase.");
  return Math.max(0, Math.floor(seconds * fps + 1e-7));
}

export function mediaDuration(asset: MediaAsset, fps: FrameRate): number {
  if (asset.kind === "image") return 4;
  if (!asset.duration || !Number.isFinite(asset.duration)) throw new Error("Media duration could not be read.");
  // Do not extend a real source to the next output frame beyond its end.
  return Math.max(1, Math.floor(asset.duration * fps + 1e-6)) / fps;
}

export function audioGain(db: number, localTime: number, duration: number, fadeIn = 0, fadeOut = 0): number {
  const fade = Math.min(1, fadeIn > 0 ? Math.max(0, localTime / fadeIn) : 1,
    fadeOut > 0 ? Math.max(0, (duration - localTime) / fadeOut) : 1);
  return 10 ** (db / 20) * fade;
}

export function trackAudible(track: Track, soloTrack?: Track | null): boolean {
  return soloTrack == null || soloTrack === track;
}

export function activeMediaAudio<T extends { id: string; mediaId?: string; muted?: boolean; track: Track; start: number; duration: number }>(
  clips: T[], time: number, visiblePictureId: string | null, soloTrack?: Track | null,
): T[] {
  return clips.filter((clip) => clip.mediaId && !clip.muted && time >= clip.start && time < clip.start + clip.duration
    && (clip.track !== 0 || clip.id === visiblePictureId) && trackAudible(clip.track, soloTrack));
}
