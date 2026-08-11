export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">
        EditForge
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-navy">
        Post-production OS
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-navy/70">
        Premium restraint finishing for commercials, faceless content, Shorts,
        Reels, and TSWS cuts. Protect existing quality. Intentional endings.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <section className="rounded-card border border-border bg-surface-elevated p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-navy">Restraint grade</h2>
          <p className="mt-2 text-sm text-navy/65">
            Subtle color, tactile sound hierarchy, still-frame holds.
          </p>
        </section>
        <section className="rounded-card border border-border bg-surface-elevated p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-navy">Verify before ship</h2>
          <p className="mt-2 text-sm text-navy/65">
            Rubric pass required. No hype grades. Humans decide.
          </p>
        </section>
      </div>
    </main>
  );
}
