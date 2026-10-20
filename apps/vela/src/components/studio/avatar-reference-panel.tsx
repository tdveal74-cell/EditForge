import { useState } from "react";
import { Btn, Kicker } from "./controls";
import { usePlate } from "./plate";
import { downloadJson, exportAvatarPack, importAvatarPack } from "@/lib/studio/avatar-media";
import { useProject, useStudio } from "@/lib/studio/store";

export function AvatarReferencePanel() {
  const project = useProject();
  const setAvatar = useStudio((state) => state.setAvatar);
  const flash = useStudio((state) => state.flash);
  const [busy, setBusy] = useState(false);
  const profile = project.avatar;
  const look = profile?.looks.find((item) => item.id === profile.selectedLookId);
  const source = usePlate(look?.assetId ?? null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); }
    catch (error) { flash(error instanceof Error ? error.message : "The reference pack could not be saved."); }
    finally { setBusy(false); }
  };

  return <section className="flex flex-col gap-2 rounded-md border border-line p-3">
    <Kicker>Avatar references</Kicker>
    <p className="text-xs text-mute">Keep supplied looks together, in their selected order. Original photos stay in this browser.</p>
    <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line px-3 text-sm">
      {busy ? "Preparing references…" : "Import reference pack"}
      <input type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        const expectedId = project.id;
        void run(async () => {
          const imported = await importAvatarPack(file);
          if (!setAvatar(imported, expectedId)) throw new Error("The project changed during import. Open it and import the pack again.");
          flash(`${imported.looks.length} original looks saved. Select a look for this take.`);
        });
      }} />
    </label>
    {profile && <>
      <p className="text-sm">{profile.name} · {profile.looks.length} looks</p>
      <label className="flex flex-col gap-1 text-xs text-mute">Selected look
        <select className="min-h-11 rounded-md border border-line bg-ink px-2 text-sm text-paper" value={profile.selectedLookId} disabled={busy} onChange={(event) => {
          setAvatar({ ...profile, selectedLookId: event.target.value, revision: profile.revision + 1 }, project.id);
        }}>
          {profile.looks.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.name}</option>)}
        </select>
      </label>
      {source && <img src={source} alt={look?.name ?? "Selected supplied photo"} className="w-full rounded object-contain" />}
      <p className="text-xs text-mute">Original reference. Booth motion is a preview; a lip-synced movie still needs rendering and review.</p>
      <Btn disabled={busy} onClick={() => void run(async () => downloadJson("avatar-references.vela.json", await exportAvatarPack(profile)))}>Download reference pack</Btn>
    </>}
  </section>;
}
