const cards = [
  { id: "t1", kind: "Episode title", text: "The Shadow We Share", rule: "Minimal. Hold. No kinetic spam." },
  { id: "t2", kind: "Lower third", text: "Auren", rule: "Sparse amber accent only if needed." },
  { id: "t3", kind: "End card", text: "Until next time.", rule: "Intentional ending / still hold." },
];

export default function TitlesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Titles</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Motion / cards</h1>
      <p className="mt-2 text-sm text-navy/65">Finishing titles — not After Effects. No template chrome.</p>
      <ul className="mt-8 space-y-3">
        {cards.map((c) => (
          <li key={c.id} className="rounded-card border border-border bg-surface-elevated p-4">
            <p className="text-xs text-navy/45">{c.kind}</p>
            <p className="text-sm font-semibold text-navy">{c.text}</p>
            <p className="mt-1 text-sm text-navy/65">{c.rule}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
