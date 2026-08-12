import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { StatusLabel, toneFor } from "@/components/ui/status-dot";
import { Section } from "@/components/ui/section";
import { ThumbnailGrid } from "@/components/media/Viewer";

export const metadata: Metadata = { title: "Dailies" };

const rolls = [
  { id: "d-0811-a", day: "2026-08-11", camera: "A-cam", scenes: "1A–1C", notes: "Cold open plates", status: "review" },
  { id: "d-0811-b", day: "2026-08-11", camera: "B-cam", scenes: "1B", notes: "Insert hands", status: "ingest" },
  { id: "d-0810-a", day: "2026-08-10", camera: "A-cam", scenes: "2A", notes: "Oracle walk", status: "approved" },
];

export default function DailiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Dailies"
        title="Day rolls"
        description="Production review queue — select, note, approve before assembly. Nothing enters the cut unreviewed."
      />

      {/* Dailies are reviewed by looking, not by reading a table. Posters
          appear per roll as media lands; until then each slot says so. */}
      <Section title="Contact sheet" count={rolls.length}>
        <ThumbnailGrid
          shots={rolls.map((r) => ({
            id: r.id,
            label: `${r.camera} · ${r.scenes}`,
            status: r.status,
          }))}
        />
      </Section>

      <ul className="mt-10 space-y-2">
        {rolls.map((r) => (
          <li
            key={r.id}
            className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-medium text-navy">{r.id}</p>
              <StatusLabel tone={toneFor(r.status)}>{r.status}</StatusLabel>
            </div>
            <p className="mt-1 text-xs tabular-nums text-navy/45">
              {r.day} · {r.camera} · scenes {r.scenes}
            </p>
            <p className="mt-2 text-sm text-navy/70">{r.notes}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
