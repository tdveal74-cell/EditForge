import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { DownloadButton } from "@/components/DownloadButton";
import { TSWS_PRESETS, buildPresetPack } from "@/lib/presets";

export const metadata: Metadata = { title: "Lane presets" };

const pack = buildPresetPack();

export default function PresetsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Lane presets"
        description="Sample restraint notes as JSON. A preset constrains the grade — it does not invent a look and is not a live LUT engine."
        actions={
          <DownloadButton filename="editforge-presets.json" body={pack} mime="application/json">
            Download presets
          </DownloadButton>
        }
      />

      <div className="mt-10 space-y-3">
        {TSWS_PRESETS.map((p) => (
          <Card key={p.id} interactive className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-navy">{p.name}</h2>
              <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-navy/45">{p.id}</code>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-navy/65">{p.description}</p>
            <ul className="mt-3 grid gap-1.5 border-t border-border-faint pt-3 sm:grid-cols-2">
              {p.restraintNotes.map((n) => (
                <li key={n} className="flex gap-2 text-xs text-navy/70">
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-navy/30" />
                  {n}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </main>
  );
}
