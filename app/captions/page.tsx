"use client";

import { useMemo, useState } from "react";
import { SAMPLE_CUES, formatSrt, type CaptionCue } from "@/lib/captions";
import { Button } from "@/components/ui/button";
import { Output } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/PageHeader";

export default function CaptionsPage() {
  const [cues] = useState<CaptionCue[]>(SAMPLE_CUES);
  const srt = useMemo(() => formatSrt(cues), [cues]);

  function download() {
    const blob = new Blob([srt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "editforge-captions.srt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PageHeader
        eyebrow="Captions"
        title="Text lane"
        description="CapCut / Descript-inspired cues. Minimal chrome — readable at a glance, not template spam."
        actions={
          <Button type="button" onClick={download}>
            Download SRT
          </Button>
        }
      />

      <Section title="Cues" count={cues.length}>
        <ul className="space-y-2">
          {cues.map((c) => (
            <li
              key={c.id}
              className="flex gap-4 rounded-card border border-border bg-surface-elevated px-4 py-3 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
            >
              <span className="shrink-0 font-mono text-[11px] tabular-nums leading-6 text-navy/40">
                {c.startSec.toFixed(1)}–{c.endSec.toFixed(1)}
              </span>
              <p className="text-sm leading-6 text-navy">{c.text}</p>
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
