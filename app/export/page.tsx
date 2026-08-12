"use client";

import { useState } from "react";
import { DELIVERABLES } from "@/lib/pipeline";
import { Button } from "@/components/ui/button";
import { Output } from "@/components/ui/field";
import { PageHeader } from "@/components/PageHeader";

export default function ExportPage() {
  const [rubricPass, setRubricPass] = useState(false);
  const [format, setFormat] = useState(DELIVERABLES[0].id);
  const [out, setOut] = useState<string | null>(null);
  const isProxy = format === "proxy";
  const blocked = !isProxy && !rubricPass;

  async function plan() {
    const res = await fetch("/api/ffmpeg/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: isProxy ? "proxy" : "export",
        rubricPass: isProxy ? true : rubricPass,
        inputPath: "master_src.mp4",
        outputPath: `${format}.mp4`,
      }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        eyebrow="Deliverables"
        title="Export"
        description="Resolve deliver + CapCut format matrix. Anything that isn't a proxy needs a recorded rubric pass first."
      />

      <ul className="mt-10 space-y-2">
        {DELIVERABLES.map((d) => {
          const on = format === d.id;
          return (
            <li key={d.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-card border p-4 shadow-card transition-all duration-flagship ease-flagship hover:shadow-lifted ${
                  on ? "border-border-strong bg-surface-elevated" : "border-border bg-surface-elevated/70"
                }`}
              >
                <input
                  type="radio"
                  name="fmt"
                  className="mt-0.5 shrink-0 cursor-pointer accent-amber"
                  checked={on}
                  onChange={() => setFormat(d.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className={`text-sm ${on ? "font-semibold text-navy" : "font-medium text-navy/80"}`}>
                      {d.label}
                    </p>
                    <span className="font-mono text-[11px] tabular-nums text-navy/40">
                      {d.width}×{d.height}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-navy/55">{d.use}</p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <label className="mt-6 flex items-center gap-2 text-sm text-navy/70">
        <input
          type="checkbox"
          className="size-4 cursor-pointer accent-amber"
          checked={rubricPass}
          onChange={(e) => setRubricPass(e.target.checked)}
          disabled={isProxy}
        />
        Rubric pass recorded {isProxy && <span className="text-navy/40">(not required for proxy)</span>}
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={plan}>
          Build export plan
        </Button>
        {blocked && (
          <span className="text-xs text-amber-700">Master export will be blocked until the rubric passes</span>
        )}
      </div>

      {out && <Output>{out}</Output>}
    </main>
  );
}
