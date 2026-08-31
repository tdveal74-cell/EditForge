import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { DownloadButton } from "@/components/DownloadButton";
import { SAMPLE_TITLE_CARDS, buildTitleSpec } from "@/lib/titles";

export const metadata: Metadata = { title: "Titles" };

const spec = buildTitleSpec();

export default function TitlesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Title cards"
        description="Sample cards as a spec file. Not After Effects, not a live compositor, not rendered motion graphics."
        actions={
          <DownloadButton filename="editforge-titles.json" body={spec} mime="application/json">
            Download spec
          </DownloadButton>
        }
      />

      <ul className="mt-10 space-y-3">
        {SAMPLE_TITLE_CARDS.map((c) => (
          <li
            key={c.id}
            className="overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
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
