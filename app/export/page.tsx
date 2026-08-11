"use client";

import { useState } from "react";
import { DELIVERABLES } from "@/lib/pipeline";
import { Button } from "@/components/ui/button";

export default function ExportPage() {
  const [rubricPass, setRubricPass] = useState(false);
  const [format, setFormat] = useState(DELIVERABLES[0].id);
  const [out, setOut] = useState<string | null>(null);

  async function plan() {
    const isProxy = format === "proxy";
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
    const data = await res.json();
    setOut(JSON.stringify(data, null, 2));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Export</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Deliverables</h1>
      <p className="mt-2 text-sm text-navy/65">
        Resolve deliver + CapCut format matrix. Master requires rubric pass.
      </p>
      <ul className="mt-6 space-y-2">
        {DELIVERABLES.map((d) => (
          <li key={d.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-card border border-border bg-surface-elevated p-3">
              <input type="radio" name="fmt" className="mt-1 accent-amber" checked={format === d.id} onChange={() => setFormat(d.id)} />
              <div>
                <p className="text-sm font-medium text-navy">{d.label}</p>
                <p className="text-xs text-navy/50">{d.width}×{d.height} · {d.use}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>
      <label className="mt-6 flex items-center gap-2 text-sm text-navy/70">
        <input type="checkbox" className="accent-amber" checked={rubricPass} onChange={(e) => setRubricPass(e.target.checked)} />
        Rubric pass (required for non-proxy)
      </label>
      <div className="mt-4"><Button type="button" onClick={plan}>Build export plan</Button></div>
      {out && <pre className="mt-6 overflow-x-auto rounded-card border border-border bg-navy p-4 text-xs text-surface">{out}</pre>}
    </main>
  );
}
