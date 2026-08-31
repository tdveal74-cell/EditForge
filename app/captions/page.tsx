"use client";

import { useMemo, useState } from "react";
import { SAMPLE_CUES, formatSrt, formatVtt, newCaptionCue, type CaptionCue } from "@/lib/captions";
import { downloadText } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Input, Output } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/PageHeader";

export default function CaptionsPage() {
  const [cues, setCues] = useState<CaptionCue[]>(SAMPLE_CUES);
  const srt = useMemo(() => formatSrt(cues), [cues]);
  const vtt = useMemo(() => formatVtt(cues), [cues]);

  function update(id: string, patch: Partial<CaptionCue>) {
    setCues((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function add() {
    setCues((list) => [...list, newCaptionCue(list[list.length - 1])]);
  }

  function remove(id: string) {
    setCues((list) => (list.length <= 1 ? list : list.filter((c) => c.id !== id)));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Caption cues"
        description="Edit cues, then download SRT or WebVTT of what you typed. Not a live captioner, not auto-transcribe, not CapCut."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => downloadText("editforge-captions.srt", srt)}>
              Download SRT
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadText("editforge-captions.vtt", vtt, "text/vtt")}
            >
              Download VTT
            </Button>
          </div>
        }
      />

      <Section
        title="Cues"
        count={cues.length}
        aside={
          <Button type="button" size="sm" variant="secondary" onClick={add}>
            Add cue
          </Button>
        }
      >
        <ul className="space-y-2">
          {cues.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-card border border-border bg-surface-elevated px-4 py-3 shadow-card sm:flex-row sm:items-center"
            >
              <div className="flex shrink-0 items-center gap-1 font-mono text-[11px] tabular-nums text-navy/40">
                <Input
                  className="w-16 py-1 text-[11px]"
                  type="number"
                  step="0.1"
                  min={0}
                  value={c.startSec}
                  onChange={(e) => update(c.id, { startSec: Number(e.target.value) })}
                  aria-label={`Start ${c.id}`}
                />
                <span>–</span>
                <Input
                  className="w-16 py-1 text-[11px]"
                  type="number"
                  step="0.1"
                  min={0}
                  value={c.endSec}
                  onChange={(e) => update(c.id, { endSec: Number(e.target.value) })}
                  aria-label={`End ${c.id}`}
                />
              </div>
              <Input
                className="text-sm"
                value={c.text}
                onChange={(e) => update(c.id, { text: e.target.value })}
                aria-label={`Cue ${c.id}`}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => remove(c.id)}
                disabled={cues.length <= 1}
                className="shrink-0"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="SRT output">
        <Output>{srt}</Output>
      </Section>
    </main>
  );
}
