"use client";

import { useMemo, useState } from "react";
import { DEFAULT_GRADE, gradeSummary, isRestraintGrade, type GradeParams } from "@/lib/grade";
import { Button } from "@/components/ui/button";

function Slider({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void;
}) {
  return (
    <label className="block text-sm text-navy/80">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-navy/50">{value.toFixed(2)}</span>
      </span>
      <input type="range" className="mt-1 w-full accent-amber" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export default function ColorPage() {
  const [g, setG] = useState<GradeParams>(DEFAULT_GRADE);
  const ok = useMemo(() => isRestraintGrade(g), [g]);
  const summary = useMemo(() => gradeSummary(g), [g]);

  function set<K extends keyof GradeParams>(key: K, v: number) {
    setG((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Color</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Restraint grade</h1>
      <p className="mt-2 text-sm text-navy/65">
        DaVinci-inspired controls, EditForge envelope. Subtle only — no hero look.
      </p>
      <div className="mt-8 space-y-5 rounded-card border border-border bg-surface-elevated p-5">
        <Slider label="Exposure" value={g.exposure} min={-0.5} max={0.5} step={0.01} onChange={(v) => set("exposure", v)} />
        <Slider label="Contrast" value={g.contrast} min={-0.5} max={0.5} step={0.01} onChange={(v) => set("contrast", v)} />
        <Slider label="Saturation" value={g.saturation} min={-0.5} max={0.5} step={0.01} onChange={(v) => set("saturation", v)} />
        <Slider label="Temperature" value={g.temperature} min={-0.5} max={0.5} step={0.01} onChange={(v) => set("temperature", v)} />
        <Slider label="Vignette" value={g.vignette} min={0} max={0.5} step={0.01} onChange={(v) => set("vignette", v)} />
      </div>
      <p className={`mt-4 text-sm ${ok ? "text-navy/70" : "text-red-700"}`}>{summary}</p>
      <div className="mt-4">
        <Button type="button" variant="secondary" onClick={() => setG(DEFAULT_GRADE)}>Reset to restraint default</Button>
      </div>
    </main>
  );
}
