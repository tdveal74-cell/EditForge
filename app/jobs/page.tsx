"use client";

import { useCallback, useEffect, useState } from "react";
import { JOB_STUBS, type StudioJob } from "@/lib/jobs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select, Output } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { StatusLabel, toneFor, toneForJob } from "@/components/ui/status-dot";
import { PageHeader } from "@/components/PageHeader";

export default function JobsPage() {
  const [kind, setKind] = useState<"proxy" | "export">("proxy");
  const [rubricPass, setRubricPass] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [live, setLive] = useState<StudioJob[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setLive(data.jobs ?? []);
      setLoadError(null);
    } catch (err) {
      // An empty list and an unreachable store are different things; say which.
      setLoadError((err as Error).message);
      setLive([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

      <Section title="Provider runs" count={live?.length}>
        <div className="mb-3 flex items-center gap-3">
          <p className="text-xs text-navy/50">
            Real records from the durable store — what the AI media pages actually submitted.
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={load} className="ml-auto">
            Refresh
          </Button>
        </div>

        {loadError && (
          <p className="rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            Could not read the job store: {loadError}
          </p>
        )}

        {live !== null && live.length === 0 && !loadError && (
          <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-navy/45">
            No provider work submitted yet. Runs from voice, avatar, and generative video land here.
          </p>
        )}

        {live === null && (
          <div className="space-y-2" aria-hidden>
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-card border border-border bg-surface-muted/50" />
            ))}
          </div>
        )}

        <ul className="space-y-2">
          {(live ?? []).map((j) => (
            <li
              key={j.id}
              className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-navy">{j.label}</p>
                <StatusLabel tone={toneForJob(j.status)}>{j.status}</StatusLabel>
              </div>
              {j.error ? (
                <p className="mt-1 text-sm text-red-700">{j.error}</p>
              ) : (
                <p className="mt-1 text-sm text-navy/65">{j.note}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-faint pt-2 text-[11px] text-navy/40">
                <span className="font-mono">{j.kind}</span>
                {j.provider && <span className="font-mono">{j.provider}</span>}
                {j.mode && (
                  <Badge tone={j.mode === "live" ? "accent" : "outline"}>
                    {j.mode === "live" ? "live" : "mock"}
                  </Badge>
                )}
                {j.attempts > 1 && <span>attempt {j.attempts}</span>}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Planned queue" count={JOB_STUBS.length}>
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
