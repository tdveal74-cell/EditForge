"use client";

import { useState } from "react";
import { SAMPLE_AVATARS, AVATAR_FLOW } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea, Output } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { StatusLabel, toneFor } from "@/components/ui/status-dot";
import { PageHeader } from "@/components/PageHeader";
import { JobRunner } from "@/components/JobRunner";
import { providerChoicesFor } from "@/lib/provider-registry";

const DESIGN_SOURCES = ["signal", "monochrome", "claude", "mat", "blockframe"];
const AVATAR_PROVIDERS = providerChoicesFor("avatar").map((p) => ({ id: p.id, label: p.label }));

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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="AI Media"
        title="Avatar / talking head"
        description="HeyGen renders the performance. EditForge owns the brief, the cut linkage, and the rubric gate."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-5">
        {/* Stage */}
        <section className="lg:col-span-3">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Stage</p>
          <div className="mt-3 overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card">
            <div className="flex min-h-[14rem] flex-col items-center justify-center bg-gradient-to-b from-navy/[0.04] to-surface-muted/40 px-6 py-12">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy/40">
                Avatar output
              </p>
              <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-navy/70">
                Completed avatar renders appear here. Until a job returns media,
                the stage stays honest — no placeholder talking head implied as live.
              </p>
              <p className="mt-5 rounded-control border border-border-faint bg-surface-elevated px-3 py-1 text-xs text-navy/50">
                Design source · {design}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-card border border-border-faint bg-surface-muted/50 px-4 py-3">
            <p className="text-xs leading-relaxed text-navy/60">
              <span className="font-medium text-navy/80">Honesty mark:</span> mock paths never
              invent face or performance media. Simulated runs are labeled. Live requires provider
              credentials and still respects the rubric before master.
            </p>
          </div>

          <Section title="Projects" count={SAMPLE_AVATARS.length}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {SAMPLE_AVATARS.map((a) => (
                <li
                  key={a.id}
                  className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-navy">{a.title}</p>
                    <StatusLabel tone={toneFor(a.status)}>{a.status}</StatusLabel>
                  </div>
                  <p className="mt-2 text-xs italic leading-relaxed text-navy/55">“{a.scriptPreview}”</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Provider flow">
            <ol className="space-y-1.5">
              {AVATAR_FLOW.map((step, i) => (
                <li key={step} className="flex gap-3 text-xs text-navy/65">
                  <span className="w-4 shrink-0 text-right font-mono tabular-nums text-navy/30">
                    {i + 1}
                  </span>
                  <span className="font-mono leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </Section>
        </section>

        {/* Brief */}
        <section className="lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Brief</p>
          <div className="mt-3 space-y-4">
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

            <Button type="button" variant="secondary" onClick={plan}>
              Build avatar plan
            </Button>

            {out && <Output>{out}</Output>}

            <JobRunner
              kind="avatar"
              label={`Avatar — ${design}`}
              prompt={prompt}
              brief={{ prompt, designSource: design }}
              options={{ designSource: design }}
              providers={AVATAR_PROVIDERS}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
