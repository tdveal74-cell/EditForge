import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { INFRA_LANES, stationsByDept } from "@/lib/hardware";

export const metadata: Metadata = { title: "Hardware" };

export default function HardwarePage() {
  const byDept = stationsByDept();
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Hardware reference"
        description="A reference board, not a live inventory and not a procurement catalog. Classes per suite — compute, memory, GPU, I/O, monitoring. Classes, not SKUs: procurement picks the current generation."
      />

      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Suites</h2>
        <div className="mt-3 space-y-4">
          {Object.entries(byDept).map(([dept, stations]) =>
            stations.map((s) => (
              <Card key={s.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-navy">{s.label}</span>
                    <Badge tone="outline">{dept}</Badge>
                  </div>
                  <Badge tone={s.tier === "flagship" ? "accent" : "neutral"}>{s.tier}</Badge>
                </div>
                <dl className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                  {(
                    [
                      ["Compute", s.compute],
                      ["Memory", s.memory],
                      ["GPU", s.gpu],
                      ["I/O", s.io],
                      ["Monitoring", s.monitoring],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="w-20 shrink-0 font-medium text-navy/45">{k}</dt>
                      <dd className="text-navy/75">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 border-t border-border-faint pt-3 text-xs italic text-navy/55">{s.notes}</p>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Shared infrastructure</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {INFRA_LANES.map((l) => (
            <Card key={l.id} className="p-4">
              <span className="text-sm font-semibold text-navy">{l.label}</span>
              <p className="mt-1 text-xs text-navy/75">{l.spec}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-navy/40">{l.role}</p>
            </Card>
          ))}
        </div>
      </section>

      <p className="mt-10 text-xs text-navy/45">
        Full spec with tier fallbacks in <code className="rounded bg-surface-muted px-1 py-0.5">docs/HARDWARE.md</code>.
      </p>
    </main>
  );
}
