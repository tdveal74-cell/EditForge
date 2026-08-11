"use client";

import { useState } from "react";
import { LONGFORM_TIERS, SAMPLE_LONGFORM, totalChapterDuration } from "@/lib/longform";
import { Button } from "@/components/ui/button";

export default function LongformPage() {
  const project = SAMPLE_LONGFORM;
  const total = totalChapterDuration(project.chapters);
  const [rubricPass, setRubricPass] = useState(false);
  const [out, setOut] = useState<string | null>(null);

  async function plan() {
    const res = await fetch("/api/longform/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rubricPass }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Long-form</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Episode / feature render</h1>
      <p className="mt-2 text-sm text-navy/65">
        Gen models make short clips. Long-form is chapters → segments → stitch → grade → rubric → master.
      </p>
      <div className="mt-6 rounded-card border border-border bg-surface-elevated p-4">
        <p className="text-sm font-semibold text-navy">{project.title}</p>
        <p className="text-xs text-navy/50">
          Target {(project.targetDurationSec / 60).toFixed(0)} min · chapters {project.chapters.length} · assembled {(total / 60).toFixed(1)} min
        </p>
      </div>
      <h2 className="mt-8 text-sm font-semibold text-navy">Tiers</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {LONGFORM_TIERS.map((t) => (
          <li key={t.id} className="rounded-card border border-border bg-surface-elevated px-3 py-2 text-sm">
            <span className="font-medium text-navy">{t.label}</span>
            <span className="text-navy/50"> · ≤{t.maxMin}m</span>
            <p className="text-xs text-navy/55">{t.notes}</p>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-sm font-semibold text-navy">Chapters</h2>
      <ol className="mt-3 space-y-2">
        {project.chapters.map((c, i) => (
          <li key={c.id} className="rounded-card border border-border bg-surface-elevated p-3">
            <div className="flex justify-between gap-2">
              <p className="text-sm font-medium text-navy">{i + 1}. {c.title}</p>
              <span className="text-xs uppercase text-navy/45">{c.segmentSource}</span>
            </div>
            <p className="text-xs text-navy/50">{c.targetDurationSec}s</p>
            <p className="mt-1 text-sm text-navy/70">{c.script}</p>
          </li>
        ))}
      </ol>
      <label className="mt-6 flex items-center gap-2 text-sm text-navy/70">
        <input type="checkbox" className="accent-amber" checked={rubricPass} onChange={(e) => setRubricPass(e.target.checked)} />
        Rubric pass (required for master stitch)
      </label>
      <div className="mt-4"><Button type="button" onClick={plan}>Build long-form stitch plan</Button></div>
      {out && <pre className="mt-6 overflow-x-auto rounded-card border border-border bg-navy p-4 text-xs text-surface">{out}</pre>}
    </main>
  );
}
