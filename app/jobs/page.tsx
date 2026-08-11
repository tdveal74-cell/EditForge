"use client";

import { useState } from "react";
import { JOB_STUBS } from "@/lib/jobs";
import { Button } from "@/components/ui/button";

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
      JSON.stringify(
        { allowed: data.allowed, reason: data.reason, command: data.plan?.command },
        null,
        2
      )
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Jobs</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">ffmpeg plans</h1>
      <p className="mt-2 text-sm text-navy/65">
        Plans only — never auto-executes. Export requires rubric pass.
      </p>

      <div className="mt-8 flex flex-wrap items-end gap-3">
        <label className="text-sm text-navy/70">
          Kind
          <select
            className="mt-1 block rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as "proxy" | "export")}
          >
            <option value="proxy">proxy</option>
            <option value="export">export</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-navy/70">
          <input
            type="checkbox"
            className="accent-amber"
            checked={rubricPass}
            onChange={(e) => setRubricPass(e.target.checked)}
          />
          Rubric pass
        </label>
        <Button type="button" onClick={plan}>
          Build plan
        </Button>
      </div>

      {result && (
        <pre className="mt-6 overflow-x-auto rounded-card border border-border bg-navy p-4 text-xs text-surface">
          {result}
        </pre>
      )}

      <h2 className="mt-12 text-sm font-semibold text-navy">Queue stubs</h2>
      <ul className="mt-3 space-y-3">
        {JOB_STUBS.map((j) => (
          <li key={j.id} className="rounded-card border border-border bg-surface-elevated p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-navy">{j.label}</p>
              <span className="text-xs uppercase tracking-wide text-navy/50">{j.status}</span>
            </div>
            <p className="mt-1 text-sm text-navy/65">{j.note}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
