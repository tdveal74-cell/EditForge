import { clsx } from "clsx";
import type { JobStatus } from "@/lib/jobs";

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

/**
 * Job statuses are a closed set, so they get an exact mapping rather than the
 * free-text matcher below — `validating` in particular is genuinely in flight
 * and would otherwise fall through to `pending` and read as "not started".
 */
const JOB_TONES: Record<JobStatus, Tone> = {
  planned: "pending",
  authorized: "pending",
  queued: "pending",
  running: "active",
  validating: "active",
  completed: "done",
  failed: "blocked",
  cancelled: "blocked",
};

export function toneForJob(status: JobStatus): Tone {
  return JOB_TONES[status];
}

/** Map free-text statuses used across the studio onto a tone. */
export function toneFor(status: string): Tone {
  const s = status.toLowerCase();
  // `archived` is settled, not unstarted — it was falling through to `pending`
  // and drawing the most finished state in the studio as "not begun".
  if (["approved", "resolved", "completed", "shipped", "archived", "done"].includes(s))
    return "done";
  // Ready is a taxonomy label for a working surface, not a finished run.
  // Live is a provider mode — in-flight work, not a settled job.
  if (s === "ready") return "pending";
  if (s === "live") return "active";
  if (["wip", "running", "processing", "review", "grade", "rendering", "stitching"].includes(s)) return "active";
  // `rejected` belongs here, not in the fallthrough: a rejected roll landing on
  // `pending` would draw the hollow "not started yet" ring, which is the exact
  // opposite of what a refusal means and indistinguishable from an un-ingested
  // one.
  if (["hold", "blocked", "failed", "cancelled", "rejected"].includes(s)) return "blocked";
  return "pending";
}
