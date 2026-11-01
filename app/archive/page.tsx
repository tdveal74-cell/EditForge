"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { downloadText } from "@/lib/download";
import { ARCHIVE_CHECKLIST, buildArchiveChecklist } from "@/lib/archive";

export default function ArchivePage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const checklistFile = useMemo(() => buildArchiveChecklist(ARCHIVE_CHECKLIST, checked), [checked]);

  function toggle(item: string) {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Archive checklist"
        description="A sample checklist, not a live archive. Boxes start empty — check them, then download. A printed checkmark would claim work nobody did."
        actions={
          <Button
            type="button"
            onClick={() => downloadText("editforge-archive-checklist.md", checklistFile, "text/markdown")}
          >
            Download checklist
          </Button>
        }
      />

      <ul className="mt-10 space-y-2">
        {ARCHIVE_CHECKLIST.map((c) => (
          <li key={c.item}>
            <label className="flex cursor-pointer gap-3 rounded-card border border-border bg-surface-elevated p-4 shadow-card">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-amber"
                checked={Boolean(checked[c.item])}
                onChange={() => toggle(c.item)}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy">{c.item}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-navy/55">{c.why}</p>
              </div>
            </label>
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
