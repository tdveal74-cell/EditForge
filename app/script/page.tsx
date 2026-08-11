const beats = [
  { scene: "1A", slug: "COLD OPEN — SHARED SHADOW", note: "Environment establishes first. No rush to dialogue." },
  { scene: "1B", slug: "QUESTION", note: "Auren asks. Hold on silence." },
  { scene: "2A", slug: "ORACLE WALK", note: "Still-frame eligible at end of beat." },
];

export default function ScriptPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Script</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Scene notes</h1>
      <p className="mt-2 text-sm text-navy/65">Continuity + editorial intent. Screenplay tools stay external; this is the production note layer.</p>
      <ul className="mt-8 space-y-3">
        {beats.map((b) => (
          <li key={b.scene} className="rounded-card border border-border bg-surface-elevated p-4">
            <p className="text-xs text-navy/45">Scene {b.scene}</p>
            <p className="text-sm font-semibold text-navy">{b.slug}</p>
            <p className="mt-2 text-sm text-navy/70">{b.note}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
