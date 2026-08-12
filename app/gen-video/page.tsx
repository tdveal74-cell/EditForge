"use client";

import { useState } from "react";
import { GEN_PROVIDERS, GEN_QUALITY_BAR } from "@/lib/genvideo";
import { Button } from "@/components/ui/button";
import { Label, Select, Input, Textarea, Output } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/PageHeader";

export default function GenVideoPage() {
  const [provider, setProvider] = useState("runway");
  const [prompt, setPrompt] = useState(
    "Locked wide: empty room, soft window light, dust in air, slow push-in, no faces, cinematic restraint, 24fps feel"
  );
  const [aspect, setAspect] = useState("16:9");
  const [quality, setQuality] = useState("social");
  const [durationSec, setDurationSec] = useState(5);
  const [out, setOut] = useState<string | null>(null);
  const meta = GEN_PROVIDERS.find((p) => p.id === provider);

  async function plan() {
    const res = await fetch("/api/gen-video/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, prompt, aspect, quality, durationSec, mode: "text-to-video" }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        eyebrow="AI Media"
        title="Generative video"
        description="Kling · Veo · Runway · Seedream–class output. EditForge holds the brief and the quality bar; providers render pixels. Rubric before master, always."
      />

      <div className="mt-10 space-y-4">
        <Label text="Provider">
          <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {GEN_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Label>
        {meta && (
          <p className="rounded-card border border-border-faint bg-surface-elevated/60 px-4 py-2.5 text-xs text-navy/60">
            {meta.strengths}
            {meta.envKey && (
              <span className="ml-2 font-mono text-navy/35">needs {meta.envKey}</span>
            )}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Label text="Aspect">
            <Select value={aspect} onChange={(e) => setAspect(e.target.value)}>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </Select>
          </Label>
          <Label text="Quality">
            <Select value={quality} onChange={(e) => setQuality(e.target.value)}>
              <option value="draft">draft</option>
              <option value="social">social</option>
              <option value="broadcast-intent">broadcast-intent</option>
            </Select>
          </Label>
          <Label text="Seconds">
            <Input
              type="number"
              min={2}
              max={30}
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
            />
          </Label>
        </div>

        <Label text="Prompt">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </Label>
      </div>

      <div className="mt-4">
        <Button type="button" onClick={plan}>
          Build gen plan
        </Button>
      </div>

      {out && <Output>{out}</Output>}

      <Section title="Quality bar" count={GEN_QUALITY_BAR.length}>
        <ul className="space-y-1.5">
          {GEN_QUALITY_BAR.map((q) => (
            <li key={q} className="flex gap-2.5 text-sm text-navy/70">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-navy/30" />
              {q}
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
