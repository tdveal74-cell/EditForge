"use client";

import { useEffect, useRef, useState } from "react";
import type { StudioJob } from "@/lib/jobs";

/**
 * Live job state over SSE, with a fetch fallback.
 *
 * Opens `/api/events` once; the first `sync` frame replaces the whole list and
 * each `job` frame after that patches one row's status without a fetch. The
 * browser's EventSource reconnects on its own and the snapshot on (re)connect
 * makes every healing path converge. If the stream is unavailable — a proxy
 * that buffers SSE, an old environment — it degrades to polling exactly as
 * before, on the same interval the page already used, so nothing breaks.
 */
export function useLiveJobs(initial: StudioJob[] | null) {
  const [jobs, setJobs] = useState<StudioJob[] | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let source: EventSource | null = null;
    let disposed = false;

    async function refetch() {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setJobs(data.jobs ?? []);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      }
    }

    function startPolling() {
      if (pollTimer.current || disposed) return;
      void refetch();
      pollTimer.current = setInterval(refetch, 30_000);
    }

    function stopPolling() {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    }

    if (typeof EventSource !== "undefined") {
      source = new EventSource("/api/events");
      source.addEventListener("open", () => {
        setLive(true);
        stopPolling();
      });
      source.addEventListener("sync", (e) => {
        try {
          const frame = JSON.parse((e as MessageEvent).data) as {
            jobs: { id: string; status: string; updatedAt: string }[];
            error?: string;
          };
          if (frame.error) throw new Error(frame.error);
          // Patch the list we already have; ids not in it arrive via job frames.
          setJobs((prev) =>
            (prev ?? []).map((j) => {
              const s = frame.jobs.find((x) => x.id === j.id);
              return s ? { ...j, status: s.status as StudioJob["status"], updatedAt: s.updatedAt } : j;
            }),
          );
        } catch {
          void refetch();
        }
      });
      source.addEventListener("job", (e) => {
        try {
          const event = JSON.parse((e as MessageEvent).data) as {
            jobId: string;
            status: string;
          };
          setJobs((prev) =>
            (prev ?? []).map((j) =>
              j.id === event.jobId
                ? { ...j, status: event.status as StudioJob["status"] }
                : j,
            ),
          );
        } catch {
          void refetch();
        }
      });
      source.addEventListener("resync", () => void refetch());
      source.addEventListener("error", () => {
        setLive(false);
        // EventSource retries on its own; keep polling until it succeeds.
        startPolling();
      });
    } else {
      startPolling();
    }

    return () => {
      disposed = true;
      stopPolling();
      source?.close();
    };
  }, []);

  return { jobs, setJobs, error, setError, live };
}
