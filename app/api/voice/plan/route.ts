import { NextResponse } from "next/server";
import { estimateTtsSeconds, SAMPLE_VOICES } from "@/lib/voice";

export async function POST(req: Request) {
  const body = await req.json();
  const text = String(body.text || "").trim();
  const voiceId = String(body.voiceId || SAMPLE_VOICES[0].id);
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const voice = SAMPLE_VOICES.find((v) => v.id === voiceId) || SAMPLE_VOICES[0];
  const seconds = estimateTtsSeconds(text);
  const configured = Boolean(process.env.ELEVENLABS_API_KEY);

  return NextResponse.json({
    plan: {
      provider: configured ? "elevenlabs" : "mock",
      voice,
      textPreview: text.slice(0, 120),
      estimatedSeconds: seconds,
      outputPath: `voice/${voiceId}-${Date.now()}.mp3`,
    },
    allowed: true,
    note: configured
      ? "API key present — wire real ElevenLabs synthesize on worker"
      : "No ELEVENLABS_API_KEY — plan only (mock). Set env for live clone/TTS.",
    consentRequired: voice.kind === "cloned",
  });
}
