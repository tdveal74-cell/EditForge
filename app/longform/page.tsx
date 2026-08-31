"use client";

import { useState } from "react";
import { LONGFORM_TIERS, SAMPLE_LONGFORM, buildLongformBoard, totalChapterDuration, type LongFormProject } from "@/lib/longform";
import { Button } from "@/components/ui/button";
import { Input, Output, Textarea } from "@/components/ui/field";
import { downloadText } from "@/lib/download";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";

export default function LongformPage() {
  const [project, setProject] = useState<LongFormProject>(SAMPLE_LONGFORM);
  const total = totalChapterDuration(project.chapters);
  const [rubricPass, setRubricPass] = useState(false);
  const [out, setOut] = useState<string | null>(null);

  async function plan() {
    const res = await fetch("/api/longform/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rubricPass }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Sample stitch plan"
        description="Edit chapters, then download the stitch plan. Not a running episode renderer. The rubric checkbox on this page is a brief for the plan — it is not a recorded ship gate."
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

      <Section title="Project">
        <div className="rounded-card border border-border bg-surface-elevated p-4 shadow-card">
          <p className="text-sm font-semibold text-navy">{project.title}</p>
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
                      setProject((prev) => ({
                        ...prev,
                        chapters: prev.chapters.map((ch) =>
                          ch.id === c.id ? { ...ch, title: e.target.value } : ch,
                        ),
                      }))
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
                  setProject((prev) => ({
                    ...prev,
                    chapters: prev.chapters.map((ch) =>
                      ch.id === c.id ? { ...ch, script: e.target.value } : ch,
                    ),
                  }))
                }
                aria-label={`Chapter ${i + 1} script`}
              />
            </li>
          ))}
        </ol>
      </Section>

      <label className="mt-8 flex items-center gap-2 text-sm text-navy/70">
        <input
          type="checkbox"
          className="size-4 cursor-pointer accent-amber"
          checked={rubricPass}
          onChange={(e) => setRubricPass(e.target.checked)}
        />
        Rubric pass recorded (required for master stitch)
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={plan}>
          Build long-form stitch plan
        </Button>
        {!rubricPass && (
          <span className="text-xs text-amber-700">Stitch stays blocked until the rubric passes</span>
        )}
      </div>

      {out && <Output>{out}</Output>}
    </main>
  );
}
