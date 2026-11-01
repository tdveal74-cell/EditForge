import { durableCollection } from "./durable";
import { AUDIO_HIERARCHY, parseAudioLevels, type AudioLevel, type AudioTrack } from "./audio";

/**
 * The one stored copy of the audio law.
 *
 * /audio used to keep edits in `useState` while /mix imported AUDIO_HIERARCHY,
 * so renaming a stem produced a law file that mix never saw. The ladder lives
 * here now; both pages and the handoff builders read it.
 */

export type StoredAudioLevel = AudioLevel & { id: AudioTrack };

function toStored(levels: AudioLevel[]): StoredAudioLevel[] {
  return levels.map((l) => ({ ...l, id: l.track }));
}

function seed(): StoredAudioLevel[] {
  return toStored(AUDIO_HIERARCHY);
}

const ladder = durableCollection<StoredAudioLevel>({
  key: "editforge:audio-law",
  file: "audio-law.json",
  seed,
});

export async function getAudioLaw(): Promise<AudioLevel[]> {
  const rows = await ladder.list();
  // Seed already wrote the ladder. Returning AUDIO_HIERARCHY here would hide a
  // stored edit (or a short store) behind the constant mix used to realise.
  return rows
    .slice()
    .sort((a, b) => a.level - b.level)
    .map(({ id: _id, ...level }) => level);
}

export async function saveAudioLaw(
  raw: unknown
): Promise<{ ok: true; levels: AudioLevel[] } | { ok: false; reason: string }> {
  const parsed = parseAudioLevels(raw);
  if (!parsed.ok) return parsed;
  const stored = toStored(parsed.levels);
  await ladder.mutate((items) => {
    items.splice(0, items.length, ...stored);
  });
  return { ok: true, levels: parsed.levels };
}
