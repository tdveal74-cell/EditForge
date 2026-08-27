import { NextResponse } from "next/server";
import { SAMPLE_VOICES, VOICE_ENV, estimateTtsSeconds, voiceEnvKeyFor } from "@/lib/voice";
import { elevenLabsVoiceId } from "@/lib/provider-registry";
import { artifactStoreConfigured } from "@/lib/artifacts";

export async function POST(req: Request) {
  const body = await req.json();
  const text = String(body.text || "").trim();
  const voiceId = String(body.voiceId || SAMPLE_VOICES[0].id);
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const voice = SAMPLE_VOICES.find((v) => v.id === voiceId) || SAMPLE_VOICES[0];
  const seconds = estimateTtsSeconds(text);

  // Three separate things have to be true before a live run works, and saying
  // "API key present" when only one of them holds is what made the old note
  // misleading: the key can be set and the run still refuse.
  const missing: string[] = [];
  if (!process.env[VOICE_ENV.apiKey]?.trim()) missing.push(VOICE_ENV.apiKey);
  // Names only — the resolved id is a provider identifier, not a secret, but it
  // is not this endpoint's job to hand it out either.
  if (!elevenLabsVoiceId(process.env, voice.id)) {
    missing.push(`${voiceEnvKeyFor(voice.id)} or ${VOICE_ENV.defaultVoice}`);
  }
  if (!artifactStoreConfigured()) missing.push("EDITFORGE_ARTIFACT_DIR");

  return NextResponse.json({
    plan: {
      provider: missing.length === 0 ? "elevenlabs" : "mock",
      voice,
      textPreview: text.slice(0, 120),
      estimatedSeconds: seconds,
      // Content-addressed at store time, so the plan can describe the shape but
      // not pretend to know the name before the bytes exist.
      outputFormat: "mp3_44100_128",
    },
    allowed: true,
    configured: missing.length === 0,
    missing,
    note:
      missing.length === 0
        ? "ElevenLabs is configured — a run synthesises the script and stores the audio in the artifact store."
        : `Plan only. A live run refuses until ${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} set.`,
    consentRequired: voice.kind === "cloned",
  });
}
