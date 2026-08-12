"use client";

import { useState } from "react";
import { JOB_STUBS } from "@/lib/jobs";
import { Button } from "@/components/ui/button";
import { Label, Select, Output } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { StatusLabel, toneFor } from "@/components/ui/status-dot";
import { PageHeader } from "@/components/PageHeader";

export default function JobsPage() {
  const [kind, setKind] = useState<"proxy" | "export">("proxy");
  const [rubricPass, setRubricPass] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function plan() {
    setResult(null);
    const res = await fetch("/api/ffmpeg/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        rubricPass,
        inputPath: "input.mp4",
        outputPath: kind === "export" ? "master.mp4" : "proxy.mp4",
      }),
    });
    const data = await res.json();
    setResult(
      JSON.stringify({ allowed: data.allowed, reason: data.reason, command: data.plan?.command }, null, 2)
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Deliverables"
        title="Transcode plans"
        description="Plans only — nothing here auto-executes. The farm runs a plan after a human confirms, and export-class work needs a rubric pass first."
      />

      <div className="mt-10 flex flex-wrap items-end gap-4">
        <div className="w-36">
          <Label text="Kind">
            <Select value={kind} onChange={(e) => setKind(e.target.value as "proxy" | "export")}>
              <option value="proxy">proxy</option>
              <option value="export">export</option>
            </Select>
          </Label>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-navy/70">
          <input
            type="checkbox"
            className="size-4 cursor-pointer accent-amber"
            checked={rubricPass}
            onChange={(e) => setRubricPass(e.target.checked)}
          />
          Rubric pass
        </label>
        <Button type="button" onClick={plan} className="mb-0.5">
          Build plan
        </Button>
      </div>

      {result && <Output>{result}</Output>}

      <Section title="Queue" count={JOB_STUBS.length}>
        <ul className="space-y-2">
          {JOB_STUBS.map((j) => (
            <li
              key={j.id}
              className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-navy">{j.label}</p>
                <StatusLabel tone={toneFor(j.status)}>{j.status}</StatusLabel>
              </div>
              <p className="mt-1 text-sm text-navy/65">{j.note}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 border-t border-border-faint pt-2 text-[11px] text-navy/40">
                <span className="font-mono">{j.kind}</span>
                <span className="font-mono">{j.idempotencyKey}</span>
                {j.requiresRubricPass && (
                  <span className="uppercase tracking-wide text-amber-700">rubric gated</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
