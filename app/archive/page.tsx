import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { DownloadButton } from "@/components/DownloadButton";
import { ARCHIVE_CHECKLIST, buildArchiveChecklist } from "@/lib/archive";

export const metadata: Metadata = { title: "Archive" };

const checklistFile = buildArchiveChecklist();

export default function ArchivePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Archive checklist"
        description="A sample checklist, not a live archive. Boxes start empty — a printed checkmark would claim work nobody did."
        actions={
          <DownloadButton filename="editforge-archive-checklist.md" body={checklistFile} mime="text/markdown">
            Download checklist
          </DownloadButton>
        }
      />

      <ul className="mt-10 space-y-2">
        {ARCHIVE_CHECKLIST.map((c) => (
          <li
            key={c.item}
            className="flex gap-3 rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            <span
              aria-hidden
              className="mt-0.5 size-4 shrink-0 rounded-sm border border-border-strong bg-surface"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy">{c.item}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-navy/55">{c.why}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-navy/45">
        Storage tiers and retention live in{" "}
        <code className="rounded bg-surface-muted px-1 py-0.5">docs/HARDWARE.md</code>. This page does
        not move files.
      </p>
    </main>
  );
}
