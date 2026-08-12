"use client";

import { useState } from "react";
import { SAMPLE_AVATARS, HYPERFRAMES_FLOW } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea, Output } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { StatusLabel, toneFor } from "@/components/ui/status-dot";
import { PageHeader } from "@/components/PageHeader";

const DESIGN_SOURCES = ["signal", "monochrome", "claude", "mat", "blockframe"];

export default function AvatarPage() {
  const [prompt, setPrompt] = useState(
    "TSWS cold open: calm navy/cream editorial. VO asks 'Where are we today?' Minimal motion. No template chrome."
  );
  const [design, setDesign] = useState("signal");
  const [out, setOut] = useState<string | null>(null);

  async function plan() {
    const res = await fetch("/api/avatar/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, designSource: design }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        eyebrow="AI Media"
        title="Avatar / HyperFrames"
        description="HeyGen-class delivery via HyperFrames. EditForge owns the brief, the cut linkage, and the rubric gate; the provider renders."
      />

      <div className="mt-10 space-y-4">
        <Label text="Design source">
          <Select value={design} onChange={(e) => setDesign(e.target.value)}>
            {DESIGN_SOURCES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Label>
        <Label text="Compose prompt">
          <Textarea
            className="min-h-[140px]"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </Label>
      </div>

      <div className="mt-4">
        <Button type="button" onClick={plan}>
          Build HyperFrames plan
        </Button>
      </div>

      {out && <Output>{out}</Output>}

      <Section title="Provider flow">
        <ol className="space-y-1.5">
          {HYPERFRAMES_FLOW.map((step, i) => (
            <li key={step} className="flex gap-3 text-xs text-navy/65">
              <span className="w-4 shrink-0 text-right font-mono tabular-nums text-navy/30">{i + 1}</span>
              <span className="font-mono leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Projects" count={SAMPLE_AVATARS.length}>
        <ul className="space-y-2">
          {SAMPLE_AVATARS.map((a) => (
            <li
              key={a.id}
              className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-navy">{a.title}</p>
                <StatusLabel tone={toneFor(a.status)}>{a.status}</StatusLabel>
              </div>
              <p className="mt-1 truncate text-xs italic text-navy/55">“{a.scriptPreview}”</p>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
