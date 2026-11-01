"use client";

import { useEffect, useState } from "react";
import type { Cut } from "@/lib/store";
import { LOUDNESS_TARGETS, TIMEBASES } from "@/lib/handoff";
import { Label, Select } from "@/components/ui/field";
import { Section } from "@/components/ui/section";

export type ArtifactKind = "edl" | "stems" | "shots" | "paths" | "plan" | "session" | "catalog" | "graph";

const COPY: Record<ArtifactKind, { file: string; what: string }> = {
  edl: { file: "CMX3600 EDL", what: "Picture conform list. A file for Resolve, Premiere, or Final Cut — this page does not run them." },
  stems: { file: "Stem sheet (CSV)", what: "One row per audio-ladder level. Not Fairlight, not a mixer." },
  session: { file: "Mix session (JSON)", what: "Ladder, clips per stem, loudness law. Not Fairlight, not Pro Tools, not a mixer." },
  shots: { file: "Shot package (JSON)", what: "Frame ranges and colour space. Not Fusion, not a compositor." },
  graph: { file: "Node graph (JSON)", what: "Loaders, Merges, Saver. Not Fusion, not After Effects, not a running comp." },
  paths: { file: "Path contract (JSON)", what: "Invented canonical paths. Not Drive, not S3, not Frame.io." },
  catalog: { file: "Catalog export (JSON)", what: "Names and filed paths from /assets. Not Drive, not S3, not Frame.io." },
  plan: {
    file: "FFmpeg plan (JSON)",
    what: "The encode command for the farm. A plan, not a render — the farm executes after a human confirms.",
  },
};

const CUTLESS: ArtifactKind[] = ["catalog"];

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
  const [jobKind, setJobKind] = useState<"proxy" | "export">("proxy");

  const needsCut = kinds.some((k) => !CUTLESS.includes(k));

  useEffect(() => {
    if (!needsCut) return;
    fetch("/api/cuts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: Cut[] = d.cuts ?? [];
        setCuts(list);
        setCutId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => setCuts([]));
  }, [needsCut]);

  const cut = cuts?.find((c) => c.id === cutId);
  const needsFps = kinds.some((k) => k === "edl" || k === "shots" || k === "graph");
  const needsTarget = kinds.some((k) => k === "stems" || k === "session");
  const needsJobKind = kinds.includes("plan");

  function href(kind: ArtifactKind): string {
    const q = new URLSearchParams({ kind });
    if (!CUTLESS.includes(kind)) q.set("cutId", cutId);
    if (kind === "edl" || kind === "shots" || kind === "graph") q.set("fps", String(fps));
    if (kind === "stems" || kind === "session") q.set("target", target);
    if (kind === "plan") q.set("jobKind", jobKind);
    return `/api/handoff?${q.toString()}`;
  }

  function enabled(kind: ArtifactKind): boolean {
    return CUTLESS.includes(kind) || Boolean(cutId);
  }

  return (
    <Section title="Take the handoff">
      <p className="mb-4 text-xs leading-relaxed text-navy/55">
        Files leave EditForge. The engine on the far side owns pixels. This is a handoff, not a live engine.
      </p>
      {needsCut && (
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

          {needsJobKind && (
            <div className="w-40">
              <Label text="Plan kind">
                <Select value={jobKind} onChange={(e) => setJobKind(e.target.value as "proxy" | "export")}>
                  <option value="proxy">proxy</option>
                  <option value="export">export</option>
                </Select>
              </Label>
            </div>
          )}
        </div>
      )}

      {needsCut && cuts?.length === 0 && kinds.every((k) => !CUTLESS.includes(k)) ? (
        <p className="mt-4 rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-navy/45">
          Nothing to hand off yet — create a cut on <code className="rounded bg-surface-muted px-1">/projects</code>.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {kinds.map((k) => (
            <li key={k}>
              <a
                href={enabled(k) ? href(k) : undefined}
                download
                aria-disabled={!enabled(k)}
                className={`block rounded-card border p-4 shadow-card transition-all duration-flagship ease-flagship ${
                  enabled(k)
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

      {cut && !cut.clips && needsCut && (
        <p className="mt-3 text-xs text-navy/45">
          “{cut.title}” has no assembly of its own yet, so these are built from the sample assembly. Each
          file states that in its own header.
        </p>
      )}
    </Section>
  );
}
