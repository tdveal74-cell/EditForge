const hierarchy = [
  { level: 1, name: "VO / dialogue", rule: "Always intelligible. Never buried." },
  { level: 2, name: "Primary SFX / tactile", rule: "Story-critical hits only." },
  { level: 3, name: "Music bed", rule: "Support, don't compete. Restraint score." },
  { level: 4, name: "Ambience", rule: "Presence, not noise floor war." },
];

export default function AudioPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Sound</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Audio hierarchy</h1>
      <p className="mt-2 text-sm text-navy/65">Fairlight / Essential Sound discipline — tactile, not loud.</p>
      <ol className="mt-8 space-y-3">
        {hierarchy.map((h) => (
          <li key={h.level} className="rounded-card border border-border bg-surface-elevated p-4">
            <p className="text-sm font-semibold text-navy">{h.level}. {h.name}</p>
            <p className="mt-1 text-sm text-navy/65">{h.rule}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
