"use client";

import { useEffect, useState } from "react";

type Health = {
  executionReady?: boolean;
  artifactStore?: boolean;
  workerConfigured?: boolean;
  workerReachable?: boolean;
  store?: string;
};

/**
 * Calm control-plane vs self-host notice.
 *
 * Vercel reports executionReady / artifactStore / worker false. That is not a
 * crash — it is the host telling the operator that this surface is the control
 * plane, and encodes plus byte-returning providers need the compose stack.
 */
export function HostNotice() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setHealth(d as Health);
      })
      .catch(() => {
        if (alive) setHealth({ executionReady: false, artifactStore: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!health) return null;

  const executionReady = Boolean(health.executionReady);
  const artifactStore = Boolean(health.artifactStore);
  if (executionReady && artifactStore) return null;

  const copy =
    !executionReady && !artifactStore
      ? "This host is the control plane. The encode worker is not attached, and the artifact store is not configured. Provider media that returns bytes and farm encodes need the self-host stack."
      : !executionReady
        ? "This host is the control plane. The encode worker is not attached — plans download, they do not run here."
        : "The artifact store is not configured. Providers that return media bytes will refuse rather than spend.";

  return (
    <aside className="mt-6 rounded-card border border-border bg-surface-muted/50 px-4 py-3" role="status">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Control plane</p>
      <p className="mt-1.5 text-sm leading-relaxed text-navy/70">{copy}</p>
    </aside>
  );
}
