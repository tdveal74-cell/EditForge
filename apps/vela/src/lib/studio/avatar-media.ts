import { audioUrl, saveMediaBatch } from "./audio-files";
import { decodeAvatarBundle, MAX_AVATAR_BYTES, sha256, type AvatarBundle, type AvatarProfile, type AudioReference } from "./avatar-reference";
import type { Project, Take } from "./model";

export async function importAvatarPack(file: File): Promise<AvatarProfile> {
  if (file.size > MAX_AVATAR_BYTES * 1.4) throw new Error("The reference pack is too large.");
  const decoded = await decodeAvatarBundle(JSON.parse(await file.text()));
  for (const look of decoded.profile.looks) {
    const media = decoded.media.find((item) => item.id === look.assetId)!;
    const bitmap = await createImageBitmap(media.blob);
    const matches = bitmap.width === look.width && bitmap.height === look.height;
    bitmap.close();
    if (!matches) throw new Error(`Image dimensions do not match: ${look.name}`);
  }
  await saveMediaBatch(decoded.media);
  return decoded.profile;
}

export async function importRead(file: File): Promise<{ id: string; reference: AudioReference }> {
  if (!file.size || file.size > 50 * 1024 * 1024) throw new Error("Choose a read smaller than 50 MB.");
  // This is decoded browser timing, not a claim about the encoded file's sample rate.
  const context = new AudioContext({ sampleRate: 48000 });
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (!decoded.length || decoded.duration > 600) throw new Error("Choose a read under ten minutes.");
    const hash = await sha256(file);
    const id = `read-${hash}`;
    await saveMediaBatch([{ id, blob: file }]);
    return { id, reference: {
      name: file.name, mime: file.type || "application/octet-stream", sha256: hash, bytes: file.size,
      decodedSampleRate: decoded.sampleRate, decodedSamples: decoded.length, duration: decoded.duration,
      identityVerified: false,
    } };
  } finally { await context.close(); }
}

async function storedBlob(id: string, expectedHash: string): Promise<Blob> {
  const url = await audioUrl(id);
  if (!url) throw new Error("A source asset is missing from this browser. Import it again.");
  const response = await fetch(url);
  const blob = await response.blob();
  if (await sha256(blob) !== expectedHash) throw new Error("A source asset changed. Import the original again.");
  return blob;
}

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () => reject(new Error("Could not package the source asset."));
    reader.readAsDataURL(blob);
  });
}

export async function exportAvatarPack(profile: AvatarProfile): Promise<AvatarBundle> {
  const assets: AvatarBundle["assets"] = [];
  for (const look of profile.looks) {
    const blob = await storedBlob(look.assetId, look.sha256);
    assets.push({ id: look.assetId, mime: look.mime, sha256: look.sha256, dataBase64: await base64(blob) });
  }
  return { schema: "vela.avatar-reference/v1", profile, assets };
}

/** A self-contained preparation packet. It never emits a ready TQO presenter row. */
export async function prepareAvatarHandoff(project: Project, take: Take) {
  const profile = project.avatar;
  const look = profile?.looks.find((item) => item.id === profile.selectedLookId);
  if (!profile || !look || project.likeness.plateId !== look.assetId) throw new Error("Select a look from the reference pack first.");
  if (!take.audioId || !take.audioReference || !take.line.trim()) throw new Error("Import the exact narration and enter its transcript first.");
  const audio = take.audioReference;
  if (take.duration !== audio.duration) throw new Error("Read timing changed. Import the narration again.");
  const photoBlob = await storedBlob(look.assetId, look.sha256);
  const audioBlob = await storedBlob(take.audioId, audio.sha256);
  const snapshot = {
    projectId: project.id, avatarId: profile.id, avatarRevision: profile.revision,
    look, audio, transcript: take.line.trim(),
    aspect: project.aspect, shot: take.shot, enhance: project.enhance, likeness: project.likeness,
    sourceAudioInSeconds: 0, sourceAudioDurationSeconds: audio.duration,
  };
  const requestHash = await sha256(new Blob([JSON.stringify(snapshot)]));
  return {
    schema: "vela.avatar-handoff/v1", requestHash, state: "prepared", execution: "not_started",
    ...snapshot,
    assets: {
      photo: { mime: photoBlob.type, dataBase64: await base64(photoBlob) },
      audio: { mime: audioBlob.type, dataBase64: await base64(audioBlob) },
    },
    render: { provider: null, targetFrameRate: null, clip: null, lipSyncVerified: false },
    workflow: { target: "TQO FINAL V5", episodeRowId: null, segmentIndex: null, registered: false },
    requiredBeforeRegistration: [
      "Bind the approved episode, segment, frame rate and exact narration trim.",
      "Verify clone identity and render with an available, authorized lip-sync worker.",
      "Review the complete rendered take and measure sync at start, middle and end.",
      "Verify the actual clip audio and worker access before registering a TQO presenter row.",
    ],
  };
}

export function downloadJson(name: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
