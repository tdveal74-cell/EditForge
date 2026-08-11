import { SAMPLE_STOCK } from "@/lib/stock";

export default function StockPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Library</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Stock · Artlist-class</h1>
      <p className="mt-2 text-sm text-navy/65">
        Music, SFX, and footage index. Wire Artlist / Epidemic keys on the worker for search + license pull.
      </p>
      <ul className="mt-8 space-y-3">
        {SAMPLE_STOCK.map((s) => (
          <li key={s.id} className="rounded-card border border-border bg-surface-elevated p-4">
            <div className="flex justify-between gap-2">
              <p className="text-sm font-medium text-navy">{s.title}</p>
              <span className="text-xs uppercase text-navy/45">{s.kind}</span>
            </div>
            <p className="mt-1 text-xs text-navy/50">{s.mood}{s.durationSec ? ` · ${s.durationSec}s` : ""}</p>
            <p className="mt-2 text-sm text-navy/65">{s.licenseNote}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
