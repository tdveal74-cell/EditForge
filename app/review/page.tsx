const notes = [
  { id: "r1", at: "00:01:12", author: "Editor", body: "Trim breath before VO.", status: "open" },
  { id: "r2", at: "00:04:40", author: "Color", body: "Hold grade inside envelope.", status: "resolved" },
  { id: "r3", at: "00:09:58", author: "Director", body: "Still hold longer on end.", status: "open" },
];

export default function ReviewPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Review</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Frame notes</h1>
      <p className="mt-2 text-sm text-navy/65">Studio QC — timestamped notes before rubric ship.</p>
      <ul className="mt-8 space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-card border border-border bg-surface-elevated p-4">
            <div className="flex justify-between gap-2">
              <span className="text-xs tabular-nums text-navy/45">{n.at}</span>
              <span className="text-xs uppercase text-navy/45">{n.status}</span>
            </div>
            <p className="mt-1 text-xs text-navy/50">{n.author}</p>
            <p className="mt-2 text-sm text-navy">{n.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
