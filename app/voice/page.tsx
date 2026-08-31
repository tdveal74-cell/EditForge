"use client";

import { useState } from "react";
import { SAMPLE_VOICES, estimateTtsSeconds } from "@/lib/voice";
import type { StudioJob } from "@/lib/jobs";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea, Output } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { JobRunner } from "@/components/JobRunner";
import { JobResultStage } from "@/components/JobResultStage";
import { providerChoicesFor } from "@/lib/provider-registry";

const VOICE_PROVIDERS = providerChoicesFor("voice").map((p) => ({ id: p.id, label: p.label }));

export default function VoicePage() {
  const [voiceId, setVoiceId] = useState(SAMPLE_VOICES[0].id);
  const [text, setText] = useState("Where are we today? Inside the question we keep avoiding.");
  const [out, setOut] = useState<string | null>(null);
  const [job, setJob] = useState<StudioJob | null>(null);
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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="AI Media"
        title="Voice clone / TTS"
        description="ElevenLabs-class VO. Cloned voices require consent and license — that gate is part of the plan, not an afterthought. Mock is the default."
        actions={
          <span className="rounded-control border border-border-faint bg-surface-elevated px-3 py-1.5 font-mono text-xs tabular-nums text-navy/60">
            ≈{seconds}s
          </span>
        }
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Listen</p>
          <div className="mt-3">
            <JobResultStage
              job={job}
              kind="audio"
              emptyTitle="No audio yet"
              emptyBody="One stage. A mock run records the job and produces no sound. Live ElevenLabs needs a key, a voice id, and the artifact store."
            />
          </div>
          <div className="mt-3 flex items-center gap-2 px-1">
            <Badge tone={voice.kind === "cloned" ? "outline" : "neutral"}>{voice.kind}</Badge>
            <span className="text-xs text-navy/50">{voice.name}</span>
          </div>

          {voice.kind === "cloned" && (
            <div className="mt-4 rounded-card border border-amber/30 bg-amber-50/80 px-4 py-3">
              <p className="text-xs font-medium text-amber-900">Consent gate</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                Cloned voice work requires an explicit consent record and license before run.
                The job runner will block until that condition is met. That is the product.
              </p>
            </div>
          )}

          <div className="mt-4 rounded-card border border-border-faint bg-surface-muted/50 px-4 py-3">
            <p className="text-xs leading-relaxed text-navy/60">
              <span className="font-medium text-navy/80">Honesty mark:</span> mock provider
              paths never invent audio. Simulated runs stay labeled. Live requires credentials.
            </p>
          </div>
        </section>

        <section className="lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Brief</p>
          <div className="mt-3 space-y-4">
            <Label text="Voice">
              <Select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                {SAMPLE_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.kind})
                  </option>
                ))}
              </Select>
            </Label>

            <Label text="Script">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
            </Label>

            <Button type="button" variant="secondary" onClick={plan}>
              Build voice plan
            </Button>

            {out && <Output>{out}</Output>}

            <JobRunner
              kind="voice"
              label={`VO — ${voice.name}`}
              prompt={text}
              brief={{ voiceId, text }}
              options={{ voiceId }}
              providers={VOICE_PROVIDERS}
              blockedReason={
                voice.kind === "cloned"
                  ? "Cloned voice: attach the consent record and licence before running. The gate is the point."
                  : undefined
              }
              hideResult
              onJobChange={setJob}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
