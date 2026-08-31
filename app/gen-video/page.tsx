"use client";

import { useState } from "react";
import { GEN_PROVIDERS, GEN_QUALITY_BAR } from "@/lib/genvideo";
import type { StudioJob } from "@/lib/jobs";
import { Button } from "@/components/ui/button";
import { Label, Select, Input, Textarea, Output } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/PageHeader";
import { JobRunner } from "@/components/JobRunner";
import { JobResultStage } from "@/components/JobResultStage";
import { providerChoicesFor } from "@/lib/provider-registry";

const GEN_JOB_PROVIDERS = providerChoicesFor("gen-video").map((p) => ({ id: p.id, label: p.label }));

export default function GenVideoPage() {
  const [provider, setProvider] = useState("mock");
  const [prompt, setPrompt] = useState(
    "Locked wide: empty room, soft window light, dust in air, slow push-in, no faces, cinematic restraint, 24fps feel"
  );
  const [aspect, setAspect] = useState("16:9");
  const [quality, setQuality] = useState("social");
  const [durationSec, setDurationSec] = useState(5);
  const [out, setOut] = useState<string | null>(null);
  const [job, setJob] = useState<StudioJob | null>(null);
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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="AI Media"
        title="Generative video"
        description="Runway is wired for text-to-video only. Kling, Veo, and Seedream stay registered and refuse. Mock is the default. Rubric before master."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Result stage</p>
          <div className="mt-3">
            <JobResultStage
              job={job}
              kind="video"
              emptyTitle="No generation yet"
              emptyBody="One stage. A mock run records the job and produces no pixels. A live run needs Runway wired with a key. This well is not a studio reference clip."
            />
          </div>

          <div className="mt-4 rounded-card border border-border-faint bg-surface-muted/50 px-4 py-3">
            <p className="text-xs leading-relaxed text-navy/60">
              <span className="font-medium text-navy/80">Honesty mark:</span> until a live provider
              key is present and a job completes, this surface shows an empty stage — not library
              footage presented as output.
            </p>
          </div>

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
        </section>

        <section className="lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Brief</p>
          <div className="mt-3 space-y-4">
            {meta && (
              <p className="rounded-card border border-border-faint bg-surface-elevated/60 px-4 py-2.5 text-xs text-navy/60">
                {meta.strengths}
                {meta.envKey && (
                  <span className="ml-2 font-mono text-navy/35">needs {meta.envKeys.join(" or ")}</span>
                )}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Label text="Aspect">
                <Select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
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
                  max={10}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                />
              </Label>
            </div>

            <Label text="Prompt">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} />
            </Label>

            <Button type="button" variant="secondary" onClick={plan}>
              Build gen plan
            </Button>

            {out && <Output>{out}</Output>}

            <JobRunner
              kind="gen-video"
              label={`Gen video — ${aspect} ${quality}`}
              prompt={prompt}
              brief={{ prompt, aspect, quality, durationSec }}
              options={{ aspect, quality, durationSec, mode: "text-to-video" }}
              providers={GEN_JOB_PROVIDERS}
              requiresRubricPass={quality === "broadcast-intent"}
              blockedReason={
                quality === "broadcast-intent"
                  ? "Broadcast-intent is master-class work — record a rubric pass first, then run."
                  : undefined
              }
              hideResult
              providerId={provider}
              onProviderChange={setProvider}
              onJobChange={setJob}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
