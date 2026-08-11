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

export const VOICE_ENV = {
  provider: "ELEVENLABS",
  apiKey: "ELEVENLABS_API_KEY",
  defaultVoice: "ELEVENLABS_VOICE_ID",
} as const;
