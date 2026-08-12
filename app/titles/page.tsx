import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Titles" };

const cards = [
  { id: "t1", kind: "Episode title", text: "The Shadow We Share", rule: "Minimal. Hold. No kinetic spam.", size: "text-2xl" },
  { id: "t2", kind: "Lower third", text: "Auren", rule: "Sparse amber accent only if needed.", size: "text-base" },
  { id: "t3", kind: "End card", text: "Until next time.", rule: "Intentional ending / still hold.", size: "text-lg" },
];

export default function TitlesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Titles"
        title="Motion / cards"
        description="Finishing titles — not After Effects. Each card previews at its intended weight so the restraint is visible, not just described."
      />

      <ul className="mt-10 space-y-3">
        {cards.map((c) => (
          <li
            key={c.id}
            className="overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            {/* Preview well — the title as it would sit on a frame. */}
            <div className="flex min-h-24 items-center justify-center border-b border-border-faint bg-navy px-6 py-8">
              <p className={`${c.size} font-semibold tracking-tight text-surface`}>{c.text}</p>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-navy/45">{c.kind}</p>
              <p className="text-xs text-navy/65">{c.rule}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
