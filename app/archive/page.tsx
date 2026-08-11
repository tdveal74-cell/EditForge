const checklist = [
  "Master + project archive linked",
  "Proxies marked disposable or kept",
  "SFX / music licenses filed",
  "Caption SRT beside master",
  "Rubric pass recorded on cut",
  "Drive / LTO path documented",
];

export default function ArchivePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Archive</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Cold storage</h1>
      <p className="mt-2 text-sm text-navy/65">Nothing ships to archive without the checklist.</p>
      <ul className="mt-8 space-y-2">
        {checklist.map((c) => (
          <li key={c} className="flex items-start gap-3 rounded-card border border-border bg-surface-elevated px-4 py-3 text-sm text-navy">
            <span className="mt-0.5 text-amber">✓</span>
            {c}
          </li>
        ))}
      </ul>
    </main>
  );
}
