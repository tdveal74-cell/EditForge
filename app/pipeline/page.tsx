import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { PIPELINE_STAGES } from "@/lib/pipeline";

export const metadata: Metadata = { title: "Pipeline" };

const next = [
  { href: "/timeline", label: "Timeline" },
  { href: "/color", label: "Grade" },
  { href: "/captions", label: "Captions" },
  { href: "/export", label: "Export" },
];

export default function PipelinePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Pipeline"
        title="Production stages"
        description="Hybrid of Resolve, Premiere, CapCut, and Descript — a finishing OS, not a full NLE. Ingest at the top, deliverable at the bottom, one gate before the end."
      />

      <ol className="relative mt-10">
        {PIPELINE_STAGES.map((s, i) => {
          const last = i === PIPELINE_STAGES.length - 1;
          const gate = s.id === "review";
          return (
            <li key={s.id} className="relative flex gap-4 pb-3 last:pb-0">
              {/* Spine connecting the stages into one flow. */}
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
              <div className="min-w-0 flex-1 rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="text-sm font-semibold text-navy">{s.label}</h2>
                  <span className="text-[11px] text-navy/40">{s.inspiredBy}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-navy/70">{s.restraintNote}</p>
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
