/**
 * The audio ladder.
 *
 * /audio calls this "law" and /mix says the mix "realises it, it does not
 * renegotiate it". That is only true if there is one copy of it.
 *
 * The `track` on each level is the timeline track it governs, which is what lets
 * a stem sheet be counted from a real cut rather than asserted.
 */
export type AudioTrack = "vo" | "sfx" | "music" | "ambience";

export type AudioLevel = {
  level: number;
  name: string;
  rule: string;
  /** The timeline track carrying this stem. */
  track: AudioTrack;
  /** Bar width on /audio — priority made visible. */
  weight: string;
};

export const AUDIO_TRACKS: AudioTrack[] = ["vo", "sfx", "music", "ambience"];

const WEIGHT_FOR: Record<AudioTrack, string> = {
  vo: "w-full",
  sfx: "w-3/4",
  music: "w-1/2",
  ambience: "w-1/4",
};

export const AUDIO_HIERARCHY: AudioLevel[] = [
  { level: 1, name: "VO / dialogue", rule: "Always intelligible. Never buried.", track: "vo", weight: WEIGHT_FOR.vo },
  { level: 2, name: "Primary SFX / tactile", rule: "Story-critical hits only.", track: "sfx", weight: WEIGHT_FOR.sfx },
  { level: 3, name: "Music bed", rule: "Support, don't compete. Restraint score.", track: "music", weight: WEIGHT_FOR.music },
  { level: 4, name: "Ambience", rule: "Presence, not noise floor war.", track: "ambience", weight: WEIGHT_FOR.ambience },
];

export function isAudioTrack(v: string): v is AudioTrack {
  return (AUDIO_TRACKS as readonly string[]).includes(v);
}

export type ParseLevelsResult =
  | { ok: true; levels: AudioLevel[] }
  | { ok: false; reason: string };

/**
 * The four-stem ladder, or a reason it is not one.
 *
 * Mix counts clips by `track`. A ladder missing a track, or carrying two of
 * the same, would silently drop stems — refuse rather than realise a broken law.
 */
export function parseAudioLevels(raw: unknown): ParseLevelsResult {
  if (!Array.isArray(raw) || raw.length !== AUDIO_TRACKS.length) {
    return { ok: false, reason: "Ladder must have four levels (VO, SFX, music, ambience)" };
  }
  const seen = new Set<string>();
  const levels: AudioLevel[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { ok: false, reason: "Each level must be an object" };
    }
    const row = item as Record<string, unknown>;
    const track = String(row.track || "");
    if (!isAudioTrack(track)) return { ok: false, reason: `Unknown track "${track}"` };
    if (seen.has(track)) return { ok: false, reason: `Duplicate track "${track}"` };
    seen.add(track);
    const name = String(row.name ?? "").trim();
    const rule = String(row.rule ?? "").trim();
    if (!name) return { ok: false, reason: "Each stem needs a name" };
    if (!rule) return { ok: false, reason: "Each stem needs a rule" };
    const level = Number(row.level);
    if (!Number.isInteger(level) || level < 1 || level > 4) {
      return { ok: false, reason: "Level must be 1–4" };
    }
    levels.push({
      level,
      name,
      rule,
      track,
      weight: WEIGHT_FOR[track],
    });
  }
  levels.sort((a, b) => a.level - b.level);
  return { ok: true, levels };
}

/**
 * The ladder as a file. Mix reads this law; this page is not a mixer.
 * Loudness numbers live on the mix stem sheet so a second copy cannot drift.
 */
export function buildAudioLaw(levels: AudioLevel[] = AUDIO_HIERARCHY): string {
  return (
    JSON.stringify(
      {
        kind: "audio-law",
        notice:
          "Audio ladder as a file. Not a mixer, not Fairlight, not Essential Sound. Mix realises this law on /mix.",
        levels: levels.map((l) => ({
          level: l.level,
          name: l.name,
          rule: l.rule,
          track: l.track,
        })),
      },
      null,
      2
    ) + "\n"
  );
}
