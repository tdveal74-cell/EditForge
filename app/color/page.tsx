"use client";

import { useMemo, useState } from "react";
import { DEFAULT_GRADE, gradeSummary, isRestraintGrade, type GradeParams } from "@/lib/grade";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { GradePreview } from "@/components/media/GradePreview";

// Mirrors lib/grade.ts isRestraintGrade: the four signed params share one bound,
// vignette gets its own. Kept beside the sliders so the two cannot disagree.
const SIGNED_LIMIT = 0.25;
const VIGNETTE_LIMIT = 0.35;

function Slider({
  label,
  value,
  min,
  max,
  step,
  limit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** This parameter's own envelope bound — vignette is allowed further than the rest. */
  limit: number;
  onChange: (n: number) => void;
}) {
  // Must match isRestraintGrade per parameter, or the readout contradicts the summary.
  const hot = Math.abs(value) > limit;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="text-navy/80">{label}</span>
        <span className={`font-mono text-xs tabular-nums ${hot ? "text-red-700" : "text-navy/45"}`}>
          {value > 0 ? "+" : ""}
          {value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        className="mt-1.5 w-full cursor-pointer accent-amber"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
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
      <PageHeader
        eyebrow="Color"
        title="Restraint grade"
        description="DaVinci-inspired controls inside the EditForge envelope. Subtle only — the grade protects the image, it does not restage it."
      />

      {/* The grade is shown before it is described. A number that claims to be
          subtle and an image that is not would otherwise never meet. */}
      <div className="mt-10">
        <GradePreview grade={g} />
      </div>

      <Card className="mt-6 space-y-5 p-5">
        <Slider label="Exposure" value={g.exposure} min={-0.5} max={0.5} step={0.01} limit={SIGNED_LIMIT} onChange={(v) => set("exposure", v)} />
        <Slider label="Contrast" value={g.contrast} min={-0.5} max={0.5} step={0.01} limit={SIGNED_LIMIT} onChange={(v) => set("contrast", v)} />
        <Slider label="Saturation" value={g.saturation} min={-0.5} max={0.5} step={0.01} limit={SIGNED_LIMIT} onChange={(v) => set("saturation", v)} />
        <Slider label="Temperature" value={g.temperature} min={-0.5} max={0.5} step={0.01} limit={SIGNED_LIMIT} onChange={(v) => set("temperature", v)} />
        <Slider label="Vignette" value={g.vignette} min={0} max={0.5} step={0.01} limit={VIGNETTE_LIMIT} onChange={(v) => set("vignette", v)} />
      </Card>

      <div
        className={`mt-4 flex items-center gap-2.5 rounded-card border px-4 py-3 text-sm ${
          ok ? "border-border bg-surface-elevated text-navy/70" : "border-red-300 bg-red-50 text-red-800"
        }`}
      >
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${ok ? "bg-navy" : "bg-red-600"}`}
        />
        {summary}
      </div>

      <div className="mt-4">
        <Button type="button" variant="secondary" onClick={() => setG(DEFAULT_GRADE)}>
          Reset to restraint default
        </Button>
      </div>
    </main>
  );
}
