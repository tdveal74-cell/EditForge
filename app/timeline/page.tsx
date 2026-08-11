"use client";

import { SAMPLE_TIMELINE, totalDuration } from "@/lib/timeline";

const tracks = ["video", "vo", "music", "sfx"] as const;
const colors: Record<string, string> = {
  video: "bg-navy",
  vo: "bg-amber",
  music: "bg-navy/50",
  sfx: "bg-navy/30",
};

export default function TimelinePage() {
  const dur = totalDuration(SAMPLE_TIMELINE);
  const scale = 40;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Timeline</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Assembly</h1>
      <p className="mt-2 text-sm text-navy/65">
        Structure before grade. Sample TSWS-style layout — not a full NLE timeline engine.
      </p>
      <p className="mt-2 text-xs text-navy/50">Duration {dur.toFixed(1)}s</p>
      <div className="mt-8 space-y-3 overflow-x-auto">
        {tracks.map((track) => (
          <div key={track} className="min-w-[640px]">
            <p className="mb-1 text-xs uppercase tracking-wide text-navy/50">{track}</p>
            <div
              className="relative h-10 rounded-control border border-border bg-surface-muted"
              style={{ width: dur * scale }}
            >
              {SAMPLE_TIMELINE.filter((c) => c.track === track).map((c) => (
                <div
                  key={c.id}
                  className={`absolute top-1 bottom-1 truncate rounded-sm px-2 text-[10px] leading-8 text-surface ${colors[track]}`}
                  style={{ left: c.startSec * scale, width: c.durationSec * scale }}
                  title={c.label}
                >
                  {c.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
