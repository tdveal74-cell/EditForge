"use client";
import { useRef, useState } from "react";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  classifyUpload,
  fileSize,
} from "./files";
export function FileUploads({
  disabled,
  onUpload,
  onError,
}: {
  disabled: boolean;
  onUpload: (file: File, progress: (n: number) => void) => Promise<void>;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(false);
  const [uploading, setUploading] = useState("");
  const [progress, setProgress] = useState(0);
  const [over, setOver] = useState(false);
  async function files(list: FileList | null) {
    if (!list?.length || disabled || active.current) return;
    active.current = true;
    try {
      for (const file of Array.from(list)) {
        classifyUpload(file.name);
        if (file.size > MAX_UPLOAD_BYTES)
          throw new Error(`${file.name} exceeds 100 MB.`);
        setUploading(`${file.name} · ${fileSize(file.size)}`);
        setProgress(0);
        await onUpload(file, setProgress);
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      active.current = false;
      setUploading("");
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div
      className={`file-drop ${over ? "drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void files(e.dataTransfer.files);
      }}
    >
      <div>
        <span className="eyebrow">Production assets</span>
        <h3>
          {uploading ? "Saving to this project…" : "Bring your own material."}
        </h3>
        <p>
          {uploading ||
            "Drop files here. Media, audio, ZIP, Markdown, text, PDFs and subtitles. Up to 100 MB per file."}
        </p>
        {uploading && (
          <progress max="100" value={progress} aria-label="Upload progress" />
        )}
      </div>
      <button
        className="primary"
        disabled={disabled || Boolean(uploading)}
        onClick={() => input.current?.click()}
      >
        {uploading ? `${progress}% uploaded` : "↑ Upload files"}
      </button>
      <input
        ref={input}
        type="file"
        accept={UPLOAD_ACCEPT}
        multiple
        hidden
        aria-label="Upload production files"
        onChange={(e) => void files(e.target.files)}
      />
    </div>
  );
}
export function uploadFile(
  file: File,
  projectId: string,
  revision: number,
  onProgress: (n: number) => void,
): Promise<{ project: import("./types").Project }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/canvas/upload");
    xhr.responseType = "json";
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Upload connection failed. Retry the file when the connection returns.",
        ),
      );
    xhr.ontimeout = () =>
      reject(
        new Error(
          "Upload timed out. Reload the project to check whether the file was saved before retrying.",
        ),
      );
    xhr.onload = () => {
      const data = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else
        reject(new Error(data?.error || `Upload failed (HTTP ${xhr.status}).`));
    };
    const form = new FormData();
    form.append("projectId", projectId);
    form.append("revision", String(revision));
    form.append("file", file);
    xhr.send(form);
  });
}
