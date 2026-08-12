"use client";

import { useEffect, useState } from "react";
import type { Cut } from "@/lib/store";
import { LOUDNESS_TARGETS, TIMEBASES } from "@/lib/handoff";
import { Label, Select } from "@/components/ui/field";
import { Section } from "@/components/ui/section";

export type ArtifactKind = "edl" | "stems" | "shots" | "paths";

const COPY: Record<ArtifactKind, { file: string; what: string }> = {
  edl: { file: "CMX3600 EDL", what: "Picture conform list. Loads in Resolve, Premiere, or Final Cut." },
  stems: { file: "Stem sheet (CSV)", what: "One row per level of the audio ladder, with the delivery target." },
  shots: { file: "Shot package (JSON)", what: "Frame ranges and colour space for comp and 3D." },
  paths: { file: "Path contract (JSON)", what: "Canonical online, nearline, and archive paths for this cut." },
};

/**
 * The download that makes a bridge a bridge.
 *
 * A plain link, not a fetch-and-blob: the server already sets the filename, the
 * browser already knows how to save a file, and a link still works if the click
 * handler never runs. The href carries the whole request, so it can be copied
 * and handed to an assistant who is not looking at this screen.
 */
export function HandoffArtifacts({ kinds }: { kinds: ArtifactKind[] }) {
  const [cuts, setCuts] = useState<Cut[] | null>(null);
  const [cutId, setCutId] = useState("");
  const [fps, setFps] = useState(25);
  const [target, setTarget] = useState(LOUDNESS_TARGETS[0].id);

  useEffect(() => {
    fetch("/api/cuts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: Cut[] = d.cuts ?? [];
        setCuts(list);
        setCutId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => setCuts([]));
  }, []);

  const cut = cuts?.find((c) => c.id === cutId);
  const needsFps = kinds.some((k) => k === "edl" || k === "shots");
  const needsTarget = kinds.includes("stems");

  function href(kind: ArtifactKind): string {
    const q = new URLSearchParams({ kind, cutId });
    if (kind === "edl" || kind === "shots") q.set("fps", String(fps));
    if (kind === "stems") q.set("target", target);
    return `/api/handoff?${q.toString()}`;
  }

  return (
    <Section title="Take the handoff">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[16rem] flex-1">
          <Label text="Cut">
            <Select value={cutId} onChange={(e) => setCutId(e.target.value)}>
              {cuts === null && <option>Loading…</option>}
              {cuts?.length === 0 && <option value="">No cuts in the store</option>}
              {cuts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Label>
        </div>

        {needsFps && (
          <div className="w-32">
            <Label text="Timebase">
              <Select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                {TIMEBASES.map((t) => (
                  <option key={t} value={t}>
                    {t} fps
                  </option>
                ))}
              </Select>
            </Label>
          </div>
        )}

        {needsTarget && (
          <div className="w-56">
            <Label text="Delivery">
              <Select value={target} onChange={(e) => setTarget(e.target.value)}>
                {LOUDNESS_TARGETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} ({t.integratedLufs} LUFS)
                  </option>
                ))}
              </Select>
            </Label>
          </div>
        )}
      </div>

      {cuts?.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-navy/45">
          Nothing to hand off yet — create a cut on <code className="rounded bg-surface-muted px-1">/projects</code>.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {kinds.map((k) => (
            <li key={k}>
              <a
                href={cutId ? href(k) : undefined}
                aria-disabled={!cutId}
                className={`block rounded-card border p-4 shadow-card transition-all duration-flagship ease-flagship ${
                  cutId
                    ? "border-border bg-surface-elevated hover:border-border-strong hover:shadow-lifted"
                    : "pointer-events-none border-border-faint bg-surface-muted/40 opacity-60"
                }`}
              >
                <p className="text-sm font-semibold text-navy">{COPY[k].file}</p>
                <p className="mt-1 text-xs leading-relaxed text-navy/65">{COPY[k].what}</p>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* An EDL of a cut with no assembly of its own is an EDL of the sample
          assembly. Say it here as well as in the file, so nobody discovers it
          after conforming. */}
      {cut && !cut.clips && (
        <p className="mt-3 text-xs text-navy/45">
          “{cut.title}” has no assembly of its own yet, so these are built from the sample assembly. Each
          file states that in its own header.
        </p>
      )}
    </Section>
  );
}
