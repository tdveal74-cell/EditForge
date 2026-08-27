export type VoiceProfile = {
  id: string;
  name: string;
  kind: "stock" | "cloned";
  language: string;
  notes: string;
};

export const SAMPLE_VOICES: VoiceProfile[] = [
  { id: "vo-auren", name: "Auren (studio)", kind: "cloned", language: "en", notes: "Primary TSWS narration — consent + license required" },
  { id: "vo-vespera", name: "Vespera (studio)", kind: "cloned", language: "en", notes: "Secondary presence — consent + license required" },
  { id: "vo-stock-narrator", name: "Stock narrator", kind: "stock", language: "en", notes: "Non-clone fallback for drafts" },
];

export function estimateTtsSeconds(text: string, wpm = 150): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / wpm) * 60));
}

/**
 * Where the provider ids live.
 *
 * The ids above are the studio's own vocabulary — "vo-auren" means nothing to
 * ElevenLabs. `ELEVENLABS_VOICE_ID` is the default the boundary falls back to,
 * and any one studio voice can be pinned to its own provider voice with
 * `ELEVENLABS_VOICE_ID_<SLUG>` (so `vo-auren` reads `ELEVENLABS_VOICE_ID_AUREN`).
 * Resolution itself lives in `lib/provider-registry.ts`, next to the wire that
 * uses it.
 */
export const VOICE_ENV = {
  provider: "ELEVENLABS",
  apiKey: "ELEVENLABS_API_KEY",
  defaultVoice: "ELEVENLABS_VOICE_ID",
  perVoicePrefix: "ELEVENLABS_VOICE_ID_",
} as const;

/** The env name that pins one studio voice to a provider voice. */
export function voiceEnvKeyFor(studioVoiceId: string): string {
  const slug = studioVoiceId.trim().replace(/^vo-/, "").replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
  return `${VOICE_ENV.perVoicePrefix}${slug}`;
}
