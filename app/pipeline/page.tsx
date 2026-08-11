import Link from "next/link";
import { PIPELINE_STAGES } from "@/lib/pipeline";

export default function PipelinePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Pipeline</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Production stages</h1>
      <p className="mt-2 text-sm text-navy/65">
        Hybrid of Resolve, Premiere, CapCut, and Descript — finishing OS, not a full NLE.
      </p>
      <ol className="mt-8 space-y-3">
        {PIPELINE_STAGES.map((s, i) => (
          <li key={s.id} className="rounded-card border border-border bg-surface-elevated p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-navy/40">{i + 1}</span>
              <h2 className="text-sm font-semibold text-navy">{s.label}</h2>
            </div>
            <p className="mt-1 text-xs text-navy/50">{s.inspiredBy}</p>
            <p className="mt-2 text-sm text-navy/70">{s.restraintNote}</p>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-navy/60">
        Next:{" "}
        <Link className="text-amber underline-offset-2 hover:underline" href="/timeline">Timeline</Link>
        {" · "}
        <Link className="text-amber underline-offset-2 hover:underline" href="/color">Grade</Link>
        {" · "}
        <Link className="text-amber underline-offset-2 hover:underline" href="/captions">Captions</Link>
        {" · "}
        <Link className="text-amber underline-offset-2 hover:underline" href="/export">Export</Link>
      </p>
    </main>
  );
}
