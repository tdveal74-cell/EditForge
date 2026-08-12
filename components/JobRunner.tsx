"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobKind, JobStatus, StudioJob } from "@/lib/jobs";
import { idempotencyKeyFor } from "@/lib/idempotency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select } from "@/components/ui/field";
import { StatusDot, toneForJob } from "@/components/ui/status-dot";

/**
 * The browser end of the worker path.
 *
 * Submits a brief to /api/jobs, then follows the job until it stops moving.
 * Every page that spends provider budget goes through this one component, so
 * the gate, the spend warning, and the mock labelling cannot be page-specific.
 */

export type ProviderChoice = { id: string; label: string };

type Props = {
  kind: JobKind;
  /** Human name for the job record. */
  label: string;
  /** The brief. Also the idempotency source — same brief, same job. */
  brief: Record<string, unknown>;
  /** What actually gets sent to the provider. */
  prompt: string;
  providers: ProviderChoice[];
  /** Provider-specific knobs passed through to the boundary. */
  options?: Record<string, unknown>;
  /** Set when a rubric pass is required before this work may be authorized. */
  requiresRubricPass?: boolean;
  /** Why the run button is unavailable, if it is. Shown in place of the hint. */
  blockedReason?: string;
};

/** Nothing advances on its own from here — polling stops and the human decides. */
const SETTLED: JobStatus[] = ["completed", "failed", "cancelled", "validating"];
const POLL_MS = 3000;
const MAX_POLLS = 40; // ~2 minutes, then hand control back rather than spin forever.

export function JobRunner({
  kind,
  label,
  brief,
  prompt,
  providers,
  options,
  requiresRubricPass,
  blockedReason,
}: Props) {
  const [provider, setProvider] = useState(providers[0]?.id ?? "mock");
  const [job, setJob] = useState<StudioJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [polls, setPolls] = useState(0);
  // Guards the poll effect against a response landing after unmount.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const key = idempotencyKeyFor(kind, { ...brief, provider });

  async function run() {
    setBusy(true);
    setError(null);
    setPolls(0);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          label,
          prompt,
          provider,
          options,
          idempotencyKey: key,
          requiresRubricPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Submit failed: HTTP ${res.status}`);
        return;
      }
      setJob(data.job);
      setLive(Boolean(data.live));
    } catch (err) {
      setError(`Could not reach the studio API: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const act = useCallback(async (id: string, action: "poll" | "complete" | "retry" | "cancel") => {
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!alive.current) return;
    if (!res.ok) {
      setError(data.error ?? `Action failed: HTTP ${res.status}`);
      return;
    }
    setError(null);
    setJob(data.job);
  }, []);

  // Follow the job while the provider still has it.
  useEffect(() => {
    if (!job || SETTLED.includes(job.status)) return;
    if (polls >= MAX_POLLS) return;
    const t = setTimeout(() => {
      setPolls((n) => n + 1);
      void act(job.id, "poll");
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [job, polls, act]);

  async function manual(action: "complete" | "retry" | "cancel" | "poll") {
    if (!job) return;
    setBusy(true);
    if (action === "retry") setPolls(0);
    await act(job.id, action);
    setBusy(false);
  }

  const tracking = job !== null && !SETTLED.includes(job.status);
  const stalled = tracking && polls >= MAX_POLLS;

  return (
    <section className="mt-6 rounded-card border border-border bg-surface-elevated p-5">
      <div className="flex flex-wrap items-end gap-3">
        <Label text="Run against" className="min-w-48 flex-1">
          <Select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={tracking}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Label>
        <Button
          type="button"
          variant="accent"
          onClick={run}
          disabled={busy || tracking || Boolean(blockedReason) || !prompt.trim()}
        >
          {busy && !job ? "Submitting…" : "Run job"}
        </Button>
      </div>

      <p className="mt-2.5 text-xs text-navy/50">
        {blockedReason ? (
          <span className="text-red-700">{blockedReason}</span>
        ) : (
          <>
            Submitting the same brief twice returns the same job — the key{" "}
            <code className="font-mono text-navy/40">{key}</code> is derived from the brief, not the click.
          </>
        )}
      </p>

      {error && (
        <p className="mt-3 rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {job && (
        <div className="mt-4 rounded-control border border-border-faint bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusDot tone={toneForJob(job.status)} />
            <span className="text-sm font-medium text-navy">{job.status}</span>
            {job.mode && (
              <Badge tone={job.mode === "live" ? "accent" : "outline"}>
                {job.mode === "live" ? "live provider" : "mock"}
              </Badge>
            )}
            {job.attempts > 1 && <Badge tone="quiet">attempt {job.attempts}</Badge>}
            <span className="ml-auto font-mono text-[10px] text-navy/35">{job.id}</span>
          </div>

          {job.note && <p className="mt-2 text-xs text-navy/60">{job.note}</p>}
          {job.error && <p className="mt-2 text-xs text-red-700">{job.error}</p>}

          {/* A mock run must never be mistakable for delivered media. */}
          {job.mode === "mock" && job.status !== "failed" && (
            <p className="mt-2 text-xs text-navy/45">
              Offline run — the lifecycle is real, the media is not. No provider was charged.
            </p>
          )}

          {job.result && (
            <a
              href={job.result}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block break-all font-mono text-xs text-navy underline underline-offset-2"
            >
              {job.result}
            </a>
          )}

          {job.status === "validating" && (
            <p className="mt-2 text-xs text-navy/60">
              Provider finished. Nothing ships until a human accepts it — that is the QC gate, not a formality.
            </p>
          )}

          {stalled && (
            <p className="mt-2 text-xs text-navy/60">
              Still running after {Math.round((MAX_POLLS * POLL_MS) / 1000)}s. Automatic polling stopped so this
              page is not left spinning; check again when you expect it to be done.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {job.status === "validating" && (
              <Button type="button" size="sm" onClick={() => manual("complete")} disabled={busy}>
                Accept and complete
              </Button>
            )}
            {job.status === "failed" && (
              <Button type="button" size="sm" variant="secondary" onClick={() => manual("retry")} disabled={busy}>
                Retry
              </Button>
            )}
            {(job.status === "queued" || job.status === "running") && (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={() => manual("poll")} disabled={busy}>
                  Check now
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => manual("cancel")} disabled={busy}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {live && !job?.mode && (
        <p className="mt-2 text-xs text-navy/45">Credentials present — this provider will bill real work.</p>
      )}
    </section>
  );
}
