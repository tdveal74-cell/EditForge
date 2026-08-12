import { clsx } from "clsx";

/**
 * Semantic run-state, encoded without a colour riot: solid navy for settled,
 * amber for the single in-flight thing (the view's one accent), a hollow ring
 * for not-yet, and a muted slash for stopped.
 */
export type Tone = "done" | "active" | "pending" | "blocked";

const dot: Record<Tone, string> = {
  done: "bg-navy",
  active: "bg-amber ring-2 ring-amber/25",
  pending: "border border-border-strong bg-transparent",
  blocked: "bg-navy/25",
};

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={clsx("size-2 shrink-0 rounded-full", dot[tone], className)} />;
}

/** Dot plus its label, for list rows. */
export function StatusLabel({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-navy/45">
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}

/** Map free-text statuses used across the studio onto a tone. */
export function toneFor(status: string): Tone {
  const s = status.toLowerCase();
  if (["approved", "resolved", "ready", "completed", "shipped", "done", "live"].includes(s)) return "done";
  if (["wip", "running", "processing", "review", "grade", "rendering", "stitching"].includes(s)) return "active";
  if (["hold", "blocked", "failed", "cancelled"].includes(s)) return "blocked";
  return "pending";
}
