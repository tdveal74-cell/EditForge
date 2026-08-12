import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { SAMPLE_STOCK } from "@/lib/stock";

export const metadata: Metadata = { title: "Stock library" };

function duration(sec?: number) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

export default function StockPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Library"
        title="Stock · Artlist-class"
        description="Music, SFX, and footage index. License terms travel with the asset — they are filed at archive, not remembered."
      />

      <ul className="mt-10 space-y-2">
        {SAMPLE_STOCK.map((s) => (
          <li
            key={s.id}
            className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-navy">{s.title}</p>
              <div className="flex items-center gap-2">
                {duration(s.durationSec) && (
                  <span className="font-mono text-[11px] tabular-nums text-navy/40">
                    {duration(s.durationSec)}
                  </span>
                )}
                <Badge tone="outline">{s.kind}</Badge>
              </div>
            </div>
            <p className="mt-1 text-xs text-navy/50">{s.mood}</p>
            <p className="mt-2 border-t border-border-faint pt-2 text-xs leading-relaxed text-navy/65">
              {s.licenseNote}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-navy/45">
        Search and license pull activate when provider keys are set on the worker.
      </p>
    </main>
  );
}
