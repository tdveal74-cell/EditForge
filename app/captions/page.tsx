"use client";

import { useMemo, useState } from "react";
import { SAMPLE_CUES, formatSrt, type CaptionCue } from "@/lib/captions";
import { Button } from "@/components/ui/button";

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
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Captions</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Text lane</h1>
      <p className="mt-2 text-sm text-navy/65">
        CapCut / Descript-inspired cues. Minimal chrome — readable, not template spam.
      </p>
      <ul className="mt-8 space-y-2">
        {cues.map((c) => (
          <li key={c.id} className="rounded-card border border-border bg-surface-elevated px-4 py-3 text-sm">
            <span className="text-xs text-navy/45">{c.startSec.toFixed(1)}s – {c.endSec.toFixed(1)}s</span>
            <p className="text-navy">{c.text}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6"><Button type="button" onClick={download}>Download SRT</Button></div>
      <pre className="mt-6 overflow-x-auto rounded-card border border-border bg-navy p-4 text-xs text-surface">{srt}</pre>
    </main>
  );
}
