/**
 * The audio ladder.
 *
 * /audio calls this "law" and /mix says the mix "realises it, it does not
 * renegotiate it". That is only true if there is one copy of it. It lived as a
 * literal inside the page, so the stem sheet crossing to the mix could say
 * something different from the screen the operator read it off.
 *
 * The `track` on each level is the timeline track it governs, which is what lets
 * a stem sheet be counted from a real cut rather than asserted.
 */
export type AudioLevel = {
  level: number;
  name: string;
  rule: string;
  /** The timeline track carrying this stem. */
  track: "vo" | "sfx" | "music" | "ambience";
  /** Bar width on /audio — priority made visible. */
  weight: string;
};

export const AUDIO_HIERARCHY: AudioLevel[] = [
  { level: 1, name: "VO / dialogue", rule: "Always intelligible. Never buried.", track: "vo", weight: "w-full" },
  { level: 2, name: "Primary SFX / tactile", rule: "Story-critical hits only.", track: "sfx", weight: "w-3/4" },
  { level: 3, name: "Music bed", rule: "Support, don't compete. Restraint score.", track: "music", weight: "w-1/2" },
  { level: 4, name: "Ambience", rule: "Presence, not noise floor war.", track: "ambience", weight: "w-1/4" },
];
