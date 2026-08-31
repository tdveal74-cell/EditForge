import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { DownloadButton } from "@/components/DownloadButton";
import { SAMPLE_BEATS, buildScriptBoard } from "@/lib/script-board";

export const metadata: Metadata = { title: "Script notes" };

const board = buildScriptBoard();

export default function ScriptPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Sample beats"
        description="Three hardcoded continuity beats. Not a screenplay tool. Screenplay apps stay external — this is a sample note layer."
        actions={
          <DownloadButton filename="editforge-script-board.json" body={board} mime="application/json">
            Download beats
          </DownloadButton>
        }
      />

      <ol className="mt-10 space-y-3">
        {SAMPLE_BEATS.map((b) => (
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
