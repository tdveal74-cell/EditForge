import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/ui/section";
import { StatusLabel, toneFor } from "@/components/ui/status-dot";

export const metadata: Metadata = { title: "Review" };

const notes = [
  { id: "r1", at: "00:01:12", author: "Editor", body: "Trim breath before VO.", status: "open" },
  { id: "r2", at: "00:04:40", author: "Color", body: "Hold grade inside envelope.", status: "resolved" },
  { id: "r3", at: "00:09:58", author: "Director", body: "Still hold longer on end.", status: "open" },
];

export default function ReviewPage() {
  const open = notes.filter((n) => n.status === "open");
  const resolved = notes.filter((n) => n.status !== "open");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Review"
        title="Frame notes"
        description="Studio QC — timestamped notes against the cut. Open notes are the work left before the rubric can be run."
      />

      {[
        { title: "Open", rows: open },
        { title: "Resolved", rows: resolved },
      ].map(({ title, rows }) => (
        <Section key={title} title={title} count={rows.length}>
          {rows.length === 0 ? (
            <p className="rounded-card border border-dashed border-border bg-surface-elevated/50 px-4 py-6 text-center text-xs text-navy/40">
              Nothing here.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((n) => (
                <li
                  key={n.id}
                  className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs tabular-nums text-navy/50">{n.at}</span>
                    <StatusLabel tone={toneFor(n.status)}>{n.status}</StatusLabel>
                  </div>
                  <p className="mt-2 text-sm text-navy">{n.body}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-navy/40">{n.author}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}
    </main>
  );
}
