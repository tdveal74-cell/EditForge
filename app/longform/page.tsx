"use client";

import { useEffect, useState } from "react";
import { LONGFORM_TIERS, SAMPLE_LONGFORM, buildLongformBoard, totalChapterDuration, type LongFormProject } from "@/lib/longform";
import { Button } from "@/components/ui/button";
import { Input, Output, Textarea, Label, Select } from "@/components/ui/field";
import { downloadText } from "@/lib/download";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import type { Cut } from "@/lib/store";

export default function LongformPage() {
  const [project, setProject] = useState<LongFormProject>(SAMPLE_LONGFORM);
  const total = totalChapterDuration(project.chapters);
  const [cuts, setCuts] = useState<Cut[] | null>(null);
  const [cutId, setCutId] = useState("");
  const [out, setOut] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/longform", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.project?.chapters?.length) setProject(d.project);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/cuts")
      .then((r) => r.json())
      .then((d) => {
        const list: Cut[] = d.cuts ?? [];
        setCuts(list);
        setCutId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => setCuts([]));
  }, []);

  async function persist(next: LongFormProject) {
    try {
      const res = await fetch("/api/longform", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: next }),
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

  async function patchProject(next: LongFormProject) {
    setProject(next);
    await persist(next);
  }

  const cut = cuts?.find((c) => c.id === cutId);
  const blocked = !cut?.rubricPass;

  async function plan() {
    const res = await fetch("/api/longform/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, cutId }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Stitch plan"
        description="Edit stored chapters, then plan those chapters. Not a running episode renderer. The stitch gate is the recorded rubric pass on a named cut — not a checkbox on this page."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-control border border-border-faint bg-surface-elevated px-3 py-1.5 font-mono text-xs tabular-nums text-navy/60">
              {(total / 60).toFixed(1)} min
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                downloadText("editforge-longform-plan.json", buildLongformBoard(project), "application/json")
              }
            >
              Download plan
            </Button>
          </div>
        }
      />

      {persistError && (
        <p className="mt-4 rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not store chapters: {persistError}
        </p>
      )}

      <Section title="Project">
        <div className="rounded-card border border-border bg-surface-elevated p-4 shadow-card">
          <Input
            className="font-semibold"
            value={project.title}
            onChange={(e) => void patchProject({ ...project, title: e.target.value })}
            aria-label="Long-form title"
          />
          <dl className="mt-3 grid grid-cols-3 gap-3">
            {[
              { k: "Target", v: `${(project.targetDurationSec / 60).toFixed(0)} min` },
              { k: "Chapters", v: String(project.chapters.length) },
              { k: "Assembled", v: `${(total / 60).toFixed(1)} min` },
            ].map((s) => (
              <div key={s.k}>
                <dd className="text-lg font-semibold tabular-nums text-navy">{s.v}</dd>
                <dt className="text-[11px] uppercase tracking-wide text-navy/45">{s.k}</dt>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section title="Tiers" count={LONGFORM_TIERS.length}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {LONGFORM_TIERS.map((t) => (
            <li
              key={t.id}
              className="rounded-card border border-border bg-surface-elevated px-4 py-3 shadow-card"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-navy">{t.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-navy/40">≤{t.maxMin}m</span>
              </div>
              <p className="mt-0.5 text-xs text-navy/55">{t.notes}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Chapters" count={project.chapters.length}>
        <ol className="space-y-2">
          {project.chapters.map((c, i) => (
            <li
              key={c.id}
              className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-navy">
                  <span className="font-mono tabular-nums text-navy/30">{i + 1}</span>
                  <Input
                    className="font-medium"
                    value={c.title}
                    onChange={(e) =>
                      void patchProject({
                        ...project,
                        chapters: project.chapters.map((ch) =>
                          ch.id === c.id ? { ...ch, title: e.target.value } : ch,
                        ),
                      })
                    }
                    aria-label={`Chapter ${i + 1} title`}
                  />
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] tabular-nums text-navy/40">
                    {c.targetDurationSec}s
                  </span>
                  <Badge tone="outline">{c.segmentSource}</Badge>
                </div>
              </div>
              <Textarea
                className="mt-1.5 min-h-[72px]"
                value={c.script}
                onChange={(e) =>
                  void patchProject({
                    ...project,
                    chapters: project.chapters.map((ch) =>
                      ch.id === c.id ? { ...ch, script: e.target.value } : ch,
                    ),
                  })
                }
                aria-label={`Chapter ${i + 1} script`}
              />
            </li>
          ))}
        </ol>
      </Section>

      <div className="mt-8">
        <Label text="Cut whose rubric pass authorises the stitch">
          <Select value={cutId} onChange={(e) => setCutId(e.target.value)}>
            {cuts === null && <option>Loading…</option>}
            {cuts?.length === 0 && <option value="">No cuts in the store</option>}
            {cuts?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — {c.rubricPass ? "rubric passed" : "no rubric pass"}
              </option>
            ))}
          </Select>
        </Label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={plan} disabled={!cutId}>
          Build long-form stitch plan
        </Button>
        {!cutId ? (
          <span className="text-xs text-amber-700">Select a cut.</span>
        ) : blocked ? (
          <span className="text-xs text-amber-700">
            {cut
              ? `“${cut.title}” has no recorded rubric pass — record one on /rubric.`
              : "Select a cut."}
          </span>
        ) : (
          <span className="text-xs text-navy/50">
            Authorised by the rubric pass recorded on “{cut?.title}”.
          </span>
        )}
      </div>

      {out && <Output>{out}</Output>}
    </main>
  );
}
