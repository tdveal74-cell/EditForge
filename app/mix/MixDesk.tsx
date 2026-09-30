"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/ui/section";
import { Input } from "@/components/ui/field";
import { HandoffArtifacts, type ArtifactKind } from "@/components/HandoffArtifacts";
import { SAMPLE_TIMELINE } from "@/lib/timeline";
import type { AudioLevel } from "@/lib/audio";

/**
 * Mix as a desk of the stored ladder, still a Bridge.
 *
 * The 24-line BridgePanel never showed the law. Session/stems still leave as
 * files; the desk renders getAudioLaw() and can edit that same copy.
 */
export function MixDesk({
  initialLevels,
  artifacts,
  notice,
}: {
  initialLevels: AudioLevel[];
  artifacts: ArtifactKind[];
  notice: string;
}) {
  const [levels, setLevels] = useState<AudioLevel[]>(initialLevels);
  const [persistError, setPersistError] = useState<string | null>(null);

  async function persist(next: AudioLevel[]) {
    try {
      const res = await fetch("/api/audio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levels: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPersistError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      setPersistError(null);
    } catch (err) {
      setPersistError((err as Error).message);
    }
  }

  async function update(level: number, patch: Partial<AudioLevel>) {
    const next = levels.map((h) => (h.level === level ? { ...h, ...patch } : h));
    setLevels(next);
    await persist(next);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader eyebrow="Bridge" title="Mix bridge" description={notice} />

      {persistError && (
        <p className="mt-4 rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not store the ladder: {persistError}
        </p>
      )}

      <Section title="Stored ladder" count={levels.length} aside="Law from /audio — this desk realises it">
        <ol className="space-y-2">
          {levels.map((h) => {
            const clips = SAMPLE_TIMELINE.filter((c) => c.track === h.track);
            const seconds = clips.reduce((sum, c) => sum + c.durationSec, 0);
            return (
              <li
                key={h.level}
                className="rounded-card border border-border bg-surface-elevated p-4 shadow-card"
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-xs font-semibold tabular-nums text-navy/35">{h.level}</span>
                  <Input
                    className="max-w-xs font-semibold"
                    value={h.name}
                    onChange={(e) => void update(h.level, { name: e.target.value })}
                    aria-label={`Mix stem ${h.level}`}
                  />
                  <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-navy/45">{h.track}</code>
                  <span className="ml-auto font-mono text-[11px] tabular-nums text-navy/40">
                    {clips.length} clip{clips.length === 1 ? "" : "s"} · {seconds.toFixed(1)}s
                  </span>
                </div>
                <Input
                  className="mt-2"
                  value={h.rule}
                  onChange={(e) => void update(h.level, { rule: e.target.value })}
                  aria-label={`Mix rule ${h.level}`}
                />
                <p className="mt-1 text-[11px] text-navy/40">
                  Clip counts here are the sample assembly. The session dump uses the selected cut, or the sample if that cut has none.
                </p>
              </li>
            );
          })}
        </ol>
      </Section>

      <HandoffArtifacts kinds={artifacts} />
    </main>
  );
}
