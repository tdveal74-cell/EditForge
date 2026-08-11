import { TSWS_PRESETS } from "@/lib/presets";

export default function PresetsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Presets</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">TSWS lanes</h1>
      <p className="mt-2 text-sm text-navy/65">
        Restraint notes locked to lane. Grade does not invent a new look.
      </p>
      <ul className="mt-8 space-y-4">
        {TSWS_PRESETS.map((p) => (
          <li key={p.id} className="rounded-card border border-border bg-surface-elevated p-5">
            <h2 className="text-sm font-semibold text-navy">{p.name}</h2>
            <p className="mt-1 text-sm text-navy/65">{p.description}</p>
            <ul className="mt-3 list-inside list-disc text-sm text-navy/70">
              {p.restraintNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
