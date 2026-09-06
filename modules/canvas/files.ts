import type { LibraryAsset } from "./types";
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const UPLOAD_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "svg",
  "heic",
  "heif",
  "tif",
  "tiff",
  "psd",
  "exr",
  "dpx",
  "mp4",
  "mov",
  "webm",
  "m4v",
  "mkv",
  "avi",
  "wmv",
  "3gp",
  "3g2",
  "mts",
  "m2ts",
  "ts",
  "mpeg",
  "mpg",
  "mp3",
  "wav",
  "m4a",
  "flac",
  "ogg",
  "aac",
  "aiff",
  "aif",
  "opus",
  "wma",
  "caf",
  "amr",
  "zip",
  "md",
  "txt",
  "json",
  "pdf",
  "srt",
  "vtt",
  "csv",
];
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(",");
export function classifyUpload(name: string): {
  extension: string;
  kind: LibraryAsset["kind"];
} {
  const extension = name.toLowerCase().split(".").pop() || "";
  if (!UPLOAD_EXTENSIONS.includes(extension))
    throw new Error(
      "Unsupported file type. Upload media, audio, ZIP, Markdown, text, PDF or subtitle files.",
    );
  const kind = ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension)
    ? "image"
    : ["mp4", "mov", "webm", "m4v"].includes(extension)
      ? "video"
      : [
            "mp3",
            "wav",
            "m4a",
            "flac",
            "ogg",
            "aac",
            "opus",
            "aiff",
            "aif",
            "wma",
            "caf",
            "amr",
          ].includes(extension)
        ? "audio"
        : "file";
  return { extension, kind };
}
export function fileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
