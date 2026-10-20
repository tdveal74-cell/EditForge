import { useState } from "react";
import { Btn, Kicker } from "./controls";
import { attachPreview, importMedia } from "@/lib/studio/media-files";
import { useProject, useStudio } from "@/lib/studio/store";
import type { Track } from "@/lib/studio/media-model";

export function MediaBin() {
  const project = useProject();
  const flash = useStudio((state) => state.flash);
  const register = useStudio((state) => state.importMediaAsset);
  const place = useStudio((state) => state.placeMedia);
  const [busy, setBusy] = useState(false);
  const [audioTrack, setAudioTrack] = useState<Track>(3);

  return <section className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3">
    <Kicker>Source media</Kicker>
    <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-line px-3 text-sm">
      {busy ? "Importing…" : "Import video, sound or stills"}
      <input type="file" multiple accept=".mp4,.mov,.webm,.wav,.ogg,.mp3,.m4a,.flac,.png,.jpg,.jpeg,.webp" className="sr-only" disabled={busy} onChange={(event) => {
        const files = Array.from(event.target.files ?? []); event.target.value = "";
        if (!files.length) return;
        const projectId = project.id;
        setBusy(true);
        void (async () => {
          let count = 0;
          for (const file of files) {
            if (useStudio.getState().activeId !== projectId) throw new Error("The project changed. Import the remaining media again.");
            const asset = await importMedia(file);
            if (!register(asset, projectId)) throw new Error("The project changed during import. The source is saved; import it into the intended project.");
            count += 1;
          }
          flash(`${count} original files imported. Add them to the cut below.`);
        })().catch((error) => flash(String(error.message ?? error))).finally(() => setBusy(false));
      }} />
    </label>
    <p className="text-xs text-mute">Original bytes stay on this browser. Unsupported codecs and files over 256 MB need a proxy.</p>
    <label className="flex flex-col gap-1 text-xs text-mute">Audio destination
      <select value={audioTrack} onChange={(e) => setAudioTrack(Number(e.target.value) as Track)} className="min-h-11 rounded border border-line bg-ink px-2 text-paper">
        {[3, 4, 5, 6, 7].map((track) => <option key={track} value={track}>A{track - 2}</option>)}
      </select>
    </label>
    {(project.media ?? []).map((asset) => <div key={asset.id} data-media-source={asset.id} className="flex flex-col gap-1 border-t border-line pt-2">
      <span className="break-words text-sm">{asset.name}</span>
      <span className="text-xs text-mute">{asset.kind} · {asset.kind === "video" ? `${asset.sourceFps ? `${asset.sourceFps} fps source` : "source fps unverified"} · ${asset.hasAudio === false ? "No embedded audio" : asset.hasAudio ? "Audio present" : "Audio streams unverified"}` : asset.kind === "image" ? `${asset.width} × ${asset.height}` : `${asset.duration?.toFixed(3) ?? "Unknown duration"}s`}{asset.locked ? " · LOCKED ORIGINAL" : ""}</span>
      {asset.kind !== "image" && <label className="inline-flex min-h-11 cursor-pointer items-center rounded border border-line px-2 text-xs">
        {asset.preview ? "Replace preview proxy" : "Attach preview proxy"}
        <input type="file" accept=".webm,.mp4,.mov,.wav,.ogg,.mp3" className="sr-only" disabled={busy} onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
          const projectId = project.id; setBusy(true);
          void attachPreview(file, asset).then((updated) => {
            if (!register(updated, projectId)) throw new Error("The project changed. Attach the proxy again.");
            flash("Preview linked. The original is unchanged. Verify the proxy content and sync before editing.");
          }).catch((error) => flash(String(error.message ?? error))).finally(() => setBusy(false));
        }} />
      </label>}
      {asset.preview && <span className="text-xs text-mute">User-linked proxy · content/sync still need verification</span>}
      {asset.kind !== "image" && !asset.browserPlayable && !asset.preview && <span className="text-xs text-copper">Attach a browser-playable proxy to preview this original.</span>}
      <Btn disabled={busy || (asset.kind !== "image" && (!asset.duration || (!asset.browserPlayable && !asset.preview)))} onClick={() => place(asset.id, asset.kind === "audio" ? audioTrack : 0)}>Add to cut</Btn>
    </div>)}
  </section>;
}
