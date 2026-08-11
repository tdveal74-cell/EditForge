const rolls = [
  { id: "d-0811-a", day: "2026-08-11", camera: "A-cam", scenes: "1A–1C", notes: "Cold open plates", status: "review" },
  { id: "d-0811-b", day: "2026-08-11", camera: "B-cam", scenes: "1B", notes: "Insert hands", status: "ingest" },
  { id: "d-0810-a", day: "2026-08-10", camera: "A-cam", scenes: "2A", notes: "Oracle walk", status: "approved" },
];

export default function DailiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Dailies</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Day rolls</h1>
      <p className="mt-2 text-sm text-navy/65">Production review queue — select, note, approve before assembly.</p>
      <ul className="mt-8 space-y-3">
        {rolls.map((r) => (
          <li key={r.id} className="rounded-card border border-border bg-surface-elevated p-4">
            <div className="flex justify-between gap-3">
              <p className="text-sm font-medium text-navy">{r.id}</p>
              <span className="text-xs uppercase text-navy/45">{r.status}</span>
            </div>
            <p className="mt-1 text-xs text-navy/50">{r.day} · {r.camera} · scenes {r.scenes}</p>
            <p className="mt-2 text-sm text-navy/70">{r.notes}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
