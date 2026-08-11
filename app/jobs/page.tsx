import { JOB_STUBS } from "@/lib/jobs";

export default function JobsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Jobs</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">ffmpeg stubs</h1>
      <p className="mt-2 text-sm text-navy/65">
        Queue shapes only. Encode workers land next — no silent auto-ship.
      </p>
      <ul className="mt-8 space-y-3">
        {JOB_STUBS.map((j) => (
          <li key={j.id} className="rounded-card border border-border bg-surface-elevated p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-navy">{j.label}</p>
              <span className="text-xs uppercase tracking-wide text-navy/50">{j.status}</span>
            </div>
            <p className="mt-1 text-sm text-navy/65">{j.note}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
