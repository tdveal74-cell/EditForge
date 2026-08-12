import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Script notes" };

const beats = [
  {
    scene: "1A",
    slug: "COLD OPEN — SHARED SHADOW",
    note: "Environment establishes first. No rush to dialogue.",
    marks: ["Establish"],
  },
  { scene: "1B", slug: "QUESTION", note: "Auren asks. Hold on silence.", marks: ["VO", "Hold"] },
  { scene: "2A", slug: "ORACLE WALK", note: "Still-frame eligible at end of beat.", marks: ["Still hold"] },
];

export default function ScriptPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Script"
        title="Scene notes"
        description="Continuity and editorial intent. Screenplay tools stay external — this is the production note layer the cut is built against."
      />

      <ol className="mt-10 space-y-3">
        {beats.map((b) => (
          <li
            key={b.scene}
            className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2.5">
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-navy/50">
                  {b.scene}
                </span>
                <h2 className="text-sm font-semibold tracking-tight text-navy">{b.slug}</h2>
              </div>
              <div className="flex gap-1.5">
                {b.marks.map((m) => (
                  <Badge key={m} tone="outline">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-navy/70">{b.note}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
