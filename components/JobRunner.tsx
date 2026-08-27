"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobKind, JobStatus, StudioJob } from "@/lib/jobs";
import { idempotencyKeyFor } from "@/lib/idempotency";
import { isPlayableAudio, isPlayableVideo } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select } from "@/components/ui/field";
import { StatusDot, toneForJob } from "@/components/ui/status-dot";

export type ProviderChoice = { id: string; label: string };

type ProviderReadiness = {
  id: string;
  billable: boolean;
  wired: boolean;
  envKey?: string;
  envKeys?: string[];
  credentialSet?: boolean;
  /** Env this provider still needs beyond its API key, e.g. an avatar look id. */
  settingsMissing?: string[];
  requiresArtifactStore?: boolean;
};

type Props = {
  kind: JobKind;
  label: string;
  brief: Record<string, unknown>;
  prompt: string;
  providers: ProviderChoice[];
  options?: Record<string, unknown>;
  requiresRubricPass?: boolean;
  blockedReason?: string;
};

const SETTLED: JobStatus[] = ["completed", "failed", "cancelled", "validating"];
const POLL_MS = 3000;
const MAX_POLLS = 40;

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
  const [readiness, setReadiness] = useState<Record<string, ProviderReadiness>>({});
  const [artifactStore, setArtifactStore] = useState(true);
  const [polls, setPolls] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/providers", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { providers: ProviderReadiness[]; artifactStore?: boolean };
        if (!alive.current) return;
        setArtifactStore(Boolean(data.artifactStore));
        setReadiness(Object.fromEntries(data.providers.map((p) => [p.id, p])));
      } catch {
        // degraded picker is fine
      }
    })();
  }, []);

  const key = idempotencyKeyFor(kind, { ...brief, provider });
  const chosen = readiness[provider];
  const missingSettings = chosen?.settingsMissing ?? [];

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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Label text="Run against" className="min-w-48 flex-1">
          <Select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={tracking}>
            {providers.map((p) => {
              const r = readiness[p.id];
              // "live" has to mean runnable, not merely credentialled: a
              // provider whose key is set but whose look id is not would other-
              // wise be offered as live and refuse on click.
              const ready = Boolean(r?.billable) && (r?.settingsMissing?.length ?? 0) === 0;
              const mark = !r ? "" : ready ? " · live" : p.id === "mock" ? "" : " · unavailable";
              return (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {mark}
                </option>
              );
            })}
          </Select>
        </Label>
        <Button
          type="button"
          variant="accent"
          className="min-h-11 w-full sm:w-auto"
          onClick={run}
          disabled={busy || tracking || Boolean(blockedReason) || !prompt.trim()}
        >
          {busy && !job ? "Submitting…" : "Run job"}
        </Button>
      </div>

      {chosen && (
        <p className="mt-2.5 text-xs">
          {chosen.billable && missingSettings.length === 0 ? (
            <span className="text-amber-700">
              Live provider — running this bills real work against {chosen.envKey}.
            </span>
          ) : chosen.id === "mock" ? (
            <span className="text-navy/50">Offline path — no spend, and no media produced.</span>
          ) : !chosen.wired ? (
            <span className="text-navy/50">
              No live path implemented for this provider yet — it will refuse rather than pretend.
            </span>
          ) : !chosen.credentialSet ? (
            <span className="text-navy/50">
              {(chosen.envKeys?.length ? chosen.envKeys : [chosen.envKey]).filter(Boolean).join(" or ")} is
              not set, so this will refuse rather than run.
            </span>
          ) : chosen.requiresArtifactStore && !artifactStore ? (
            <span className="text-navy/50">
              This provider answers with the media itself and EDITFORGE_ARTIFACT_DIR is not set, so there
              is nowhere to keep it. It will refuse rather than spend.
            </span>
          ) : missingSettings.length > 0 ? (
            // Without this, a HeyGen render refused for a missing look id reads
            // as a bad API key — the one thing that is not wrong.
            <span className="text-navy/50">
              The key is set, but {missingSettings.join(" and ")}{" "}
              {missingSettings.length > 1 ? "are" : "is"} not — this will refuse until{" "}
              {missingSettings.length > 1 ? "they are" : "it is"} configured.
            </span>
          ) : (
            <span className="text-navy/50">This provider is not ready to run live yet.</span>
          )}
        </p>
      )}

      <p className="mt-1.5 text-xs text-navy/50">
        {blockedReason ? (
          <span className="text-red-700">{blockedReason}</span>
        ) : (
          <>
            Submitting the same brief twice returns the same job — the key{" "}
            <code className="font-mono text-navy/40">{key}</code> is derived from the brief, not the
            click.
          </>
        )}
      </p>

      {error && (
        <p className="mt-3 rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {job && (
        <div className="mt-4 space-y-3">
          {/* Result stage */}
          {(job.status === "completed" || job.status === "validating") && (
            <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
              <div className="flex min-h-[8rem] flex-col items-center justify-center bg-navy/[0.03] px-4 py-8">
                {job.result ? (
                  <>
                    <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">
                      Result ready
                    </p>
                    {/* Play it here. A finished VO that can only be opened in
                        another tab is a link, not a result — and judging a take
                        is the whole reason to come back to this page. */}
                    {isPlayableAudio(job.result) ? (
                      <audio className="mt-3 w-full max-w-md" controls preload="metadata" src={job.result} />
                    ) : isPlayableVideo(job.result) ? (
                      <video
                        className="mt-3 max-h-64 w-full max-w-md rounded-control bg-navy/5"
                        controls
                        preload="metadata"
                        src={job.result}
                      />
                    ) : null}
                    <a
                      href={job.result}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 max-w-full break-all font-mono text-xs text-navy underline underline-offset-2"
                    >
                      {job.result}
                    </a>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">
                      {job.status === "validating" ? "Awaiting human accept" : "Lifecycle complete"}
                    </p>
                    <p className="mt-2 max-w-sm text-center text-sm text-navy/65">
                      {job.mode === "mock"
                        ? "Mock path — no media file was produced. The job record is real."
                        : "Provider finished. Open the result when a URL is present."}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="rounded-control border border-border-faint bg-surface p-4">
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

            {job.mode === "mock" && job.status !== "failed" && (
              <p className="mt-2 text-xs text-navy/45">
                Offline run — the lifecycle is real, the media is not. No provider was charged.
              </p>
            )}

            {job.status === "validating" && (
              <p className="mt-2 text-xs text-navy/60">
                Provider finished. Nothing ships until a human accepts it — that is the QC gate, not a
                formality.
              </p>
            )}

            {stalled && (
              <p className="mt-2 text-xs text-navy/60">
                Still running after {Math.round((MAX_POLLS * POLL_MS) / 1000)}s. Automatic polling
                stopped so this page is not left spinning; check again when you expect it to be done.
              </p>
            )}

            <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              {job.status === "validating" && (
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => manual("complete")}
                  disabled={busy}
                >
                  Accept and complete
                </Button>
              )}
              {job.status === "failed" && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => manual("retry")}
                  disabled={busy}
                >
                  Retry
                </Button>
              )}
              {(job.status === "queued" || job.status === "running") && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => manual("poll")}
                    disabled={busy}
                  >
                    Check now
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => manual("cancel")}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
