"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { downloadText } from "@/lib/download";
import { PIPELINE_STAGES, buildPipelineMap } from "@/lib/pipeline";

const next = [
  { href: "/timeline", label: "Timeline" },
  { href: "/color", label: "Grade" },
  { href: "/captions", label: "Captions" },
  { href: "/jobs", label: "Jobs" },
];

export default function PipelinePage() {
  const [stages, setStages] = useState(PIPELINE_STAGES);
  const map = useMemo(() => buildPipelineMap(stages), [stages]);

  function update(id: string, patch: Partial<(typeof PIPELINE_STAGES)[number]>) {
    setStages((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Stage map"
        description="Edit stage notes, then download the map. Not a running pipeline, not Resolve, Premiere, CapCut, or Descript — those stay external."
        actions={
          <Button type="button" onClick={() => downloadText("editforge-pipeline.json", map, "application/json")}>
            Download map
          </Button>
        }
      />

      <ol className="relative mt-10">
        {stages.map((s, i) => {
          const last = i === stages.length - 1;
          const gate = s.id === "review";
          return (
            <li key={s.id} className="relative flex gap-4 pb-3 last:pb-0">
              {!last && (
                <span aria-hidden className="absolute left-[15px] top-9 bottom-0 w-px bg-border" />
              )}
              <span
                aria-hidden
                className={
                  "relative z-10 mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums " +
                  (gate
                    ? "border-amber bg-amber-50 text-amber-700"
                    : "border-border-strong bg-surface-elevated text-navy/50")
                }
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 rounded-card border border-border bg-surface-elevated p-4 shadow-card">
                <Input
                  className="font-semibold"
                  value={s.label}
                  onChange={(e) => update(s.id, { label: e.target.value })}
                  aria-label={`Stage ${s.id}`}
                />
                <Textarea
                  className="mt-2 min-h-[72px]"
                  value={s.restraintNote}
                  onChange={(e) => update(s.id, { restraintNote: e.target.value })}
                  aria-label={`Note ${s.id}`}
                />
                {gate && (
                  <p className="mt-2 border-t border-border-faint pt-2 text-[11px] uppercase tracking-wide text-amber-700">
                    Human gate — nothing passes without a rubric decision
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-10 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-navy/55">
        <span className="text-navy/40">Jump to</span>
        {next.map((n, i) => (
          <span key={n.href}>
            {i > 0 && <span className="px-1 text-navy/25">·</span>}
            <Link
              href={n.href}
              className="rounded-sm text-navy/70 underline-offset-4 transition-colors duration-flagship hover:text-navy hover:underline"
            >
              {n.label}
            </Link>
          </span>
        ))}
      </p>
    </main>
  );
}
