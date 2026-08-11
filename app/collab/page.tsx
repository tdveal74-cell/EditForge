const roles = [
  { role: "Director", access: "Review · rubric · ship" },
  { role: "Editor", access: "Timeline · cuts · captions" },
  { role: "Color", access: "Grade envelope · notes" },
  { role: "Sound", access: "Hierarchy · stems" },
  { role: "Producer", access: "Projects · dailies · archive" },
];

export default function CollabPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Studio</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Collaboration</h1>
      <p className="mt-2 text-sm text-navy/65">Roles for handoff. Auth wiring comes with deploy.</p>
      <ul className="mt-8 space-y-2">
        {roles.map((r) => (
          <li key={r.role} className="rounded-card border border-border bg-surface-elevated px-4 py-3">
            <p className="text-sm font-semibold text-navy">{r.role}</p>
            <p className="text-xs text-navy/55">{r.access}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
