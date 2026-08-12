"use client";

import { useState } from "react";
import { SAMPLE_VOICES, estimateTtsSeconds } from "@/lib/voice";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea, Output } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";

export default function VoicePage() {
  const [voiceId, setVoiceId] = useState(SAMPLE_VOICES[0].id);
  const [text, setText] = useState("Where are we today? Inside the question we keep avoiding.");
  const [out, setOut] = useState<string | null>(null);
  const voice = SAMPLE_VOICES.find((v) => v.id === voiceId) ?? SAMPLE_VOICES[0];
  const seconds = estimateTtsSeconds(text);

  async function plan() {
    const res = await fetch("/api/voice/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId, text }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        eyebrow="AI Media"
        title="Voice clone / TTS"
        description="ElevenLabs-class VO. Cloned voices require a consent record and a license — that gate is part of the plan, not an afterthought."
        actions={
          <span className="rounded-control border border-border-faint bg-surface-elevated px-3 py-1.5 font-mono text-xs tabular-nums text-navy/60">
            ≈{seconds}s
          </span>
        }
      />

      <div className="mt-10 space-y-4">
        <Label text="Voice">
          <Select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
            {SAMPLE_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.kind})
              </option>
            ))}
          </Select>
        </Label>

        <div className="flex flex-wrap items-center gap-2 rounded-card border border-border-faint bg-surface-elevated/60 px-4 py-3">
          <Badge tone={voice.kind === "cloned" ? "accent" : "neutral"}>{voice.kind}</Badge>
          <p className="text-xs text-navy/60">{voice.notes}</p>
        </div>

        <Label text="Script">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} />
        </Label>
      </div>

      <div className="mt-4">
        <Button type="button" onClick={plan}>
          Build voice plan
        </Button>
      </div>

      {out && <Output>{out}</Output>}
    </main>
  );
}
