const shots = [
  { id: "VFX_010", desc: "Shadow realm establish", status: "todo", engine: "Fusion / AE external" },
  { id: "VFX_020", desc: "Subtle particulate", status: "wip", engine: "Fusion / AE external" },
  { id: "VFX_030", desc: "End still enhancement", status: "hold", engine: "Restraint only" },
];

export default function VfxPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">VFX</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Shot board</h1>
      <p className="mt-2 text-sm text-navy/65">Tracker only. Heavy comp stays in Fusion, After Effects, or 3D tools.</p>
      <ul className="mt-8 space-y-3">
        {shots.map((s) => (
          <li key={s.id} className="rounded-card border border-border bg-surface-elevated p-4">
            <div className="flex justify-between">
              <p className="text-sm font-semibold text-navy">{s.id}</p>
              <span className="text-xs uppercase text-navy/45">{s.status}</span>
            </div>
            <p className="mt-1 text-sm text-navy/70">{s.desc}</p>
            <p className="mt-1 text-xs text-navy/45">{s.engine}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
