"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/ui/section";
import { Waveform } from "@/components/media/Viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { downloadText } from "@/lib/download";
import { AUDIO_HIERARCHY, buildAudioLaw, type AudioLevel } from "@/lib/audio";
import { PRIMARY_CLIP } from "@/lib/mediaLibrary";

export default function AudioPage() {
  const [hierarchy, setHierarchy] = useState<AudioLevel[]>(AUDIO_HIERARCHY);
  const law = useMemo(() => buildAudioLaw(hierarchy), [hierarchy]);

  useEffect(() => {
    fetch("/api/audio", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.levels) && d.levels.length) setHierarchy(d.levels);
      })
      .catch(() => undefined);
  }, []);

  function persist(next: AudioLevel[]) {
    void fetch("/api/audio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ levels: next }),
    });
  }

  function update(level: number, patch: Partial<AudioLevel>) {
    const next = hierarchy.map((h) => (h.level === level ? { ...h, ...patch } : h));
    setHierarchy(next);
    persist(next);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Audio ladder"
        description="Edit the rules; they are stored and /mix realises them. Not a mixer, not Fairlight, not Essential Sound."
        actions={
          <Button type="button" onClick={() => downloadText("editforge-audio-law.json", law, "application/json")}>
            Download law
          </Button>
        }
      />

      <Section title="Attached waveform">
        <Waveform src={PRIMARY_CLIP.src} />
        <p className="mt-2 text-xs text-navy/45">Studio reference clip — not a mix print.</p>
      </Section>

      <ol className="mt-10 space-y-2">
        {hierarchy.map((h) => (
          <li
            key={h.level}
            className="group relative overflow-hidden rounded-card border border-border bg-surface-elevated p-4 shadow-card"
          >
            <span aria-hidden className={`absolute inset-y-0 left-0 ${h.weight} bg-surface-muted/70`} />
            <div className="relative flex items-baseline gap-3">
              <span className="text-xs font-semibold tabular-nums text-navy/35">{h.level}</span>
              <Input
                className="max-w-xs font-semibold"
                value={h.name}
                onChange={(e) => update(h.level, { name: e.target.value })}
                aria-label={`Stem ${h.level}`}
              />
              <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-navy/45">{h.track}</code>
            </div>
            <Input
              className="relative mt-2 pl-7"
              value={h.rule}
              onChange={(e) => update(h.level, { rule: e.target.value })}
              aria-label={`Rule ${h.level}`}
            />
          </li>
        ))}
      </ol>

      <p className="mt-8 text-xs text-navy/45">
        Track names stay fixed so the mix session can count clips. Stem split and loudness targets cross to{" "}
        <code className="rounded bg-surface-muted px-1 py-0.5">/mix</code>.
      </p>
    </main>
  );
}
