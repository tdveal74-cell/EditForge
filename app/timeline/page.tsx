"use client";

import { SAMPLE_TIMELINE, TRACK_ORDER, totalDuration } from "@/lib/timeline";
import { PageHeader } from "@/components/PageHeader";

// Rows follow the audio ladder top-down. They used to run video/vo/music/sfx,
// which drew music above the SFX that outranks it — the screen contradicting the
// rule /audio calls law.
const tracks = TRACK_ORDER;

// Fills follow the same ladder: VO is the one amber accent, everything else
// steps down the navy ramp so no track shouts over the one that matters.
const fill: Record<string, string> = {
  video: "bg-navy",
  vo: "bg-amber",
  sfx: "bg-navy/45",
  music: "bg-navy/30",
  ambience: "bg-navy/15",
};

const ink: Record<string, string> = {
  video: "text-surface",
  vo: "text-navy",
  sfx: "text-surface",
  music: "text-navy/80",
  ambience: "text-navy/70",
};

export default function TimelinePage() {
  const dur = totalDuration(SAMPLE_TIMELINE);
  const scale = 44;
  const ticks = Array.from({ length: Math.ceil(dur / 5) + 1 }, (_, i) => i * 5);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        eyebrow="Timeline"
        title="Assembly"
        description="Structure before grade. A sample TSWS-style layout — the shape of the cut, not a full NLE timeline engine."
        actions={
          <span className="rounded-control border border-border-faint bg-surface-elevated px-3 py-1.5 font-mono text-xs tabular-nums text-navy/60">
            {dur.toFixed(1)}s
          </span>
        }
      />

      <div className="mt-10 overflow-x-auto pb-2">
        {/* w-max so the row sizes to label gutter + track, whatever the scale. */}
        <div className="w-max pr-2">
          {/* Ruler — sits in the same flex row as the tracks so its ticks line
              up with the gridlines instead of floating a label-width to the left. */}
          <div className="mb-1 flex items-center gap-3">
            <span aria-hidden className="w-12 shrink-0" />
            <div className="relative h-4" style={{ width: dur * scale }}>
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute top-0 font-mono text-[10px] tabular-nums text-navy/35"
                  style={{ left: t * scale }}
                >
                  {t}s
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {tracks.map((track) => (
              <div key={track} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-right text-[10px] uppercase tracking-wide text-navy/45">
                  {track}
                </span>
                <div
                  className="relative h-11 rounded-control border border-border bg-surface-muted/60"
                  style={{ width: dur * scale }}
                >
                  {ticks.map((t) => (
                    <span
                      key={t}
                      aria-hidden
                      className="absolute inset-y-0 w-px bg-border/60"
                      style={{ left: t * scale }}
                    />
                  ))}
                  {SAMPLE_TIMELINE.filter((c) => c.track === track).map((c) => (
                    <div
                      key={c.id}
                      title={`${c.label} · ${c.startSec}s–${c.startSec + c.durationSec}s`}
                      className={`absolute inset-y-1 truncate rounded-sm px-2 text-[10px] leading-9 shadow-card transition-transform duration-flagship ease-flagship hover:-translate-y-px ${fill[track]} ${ink[track]}`}
                      style={{ left: c.startSec * scale, width: c.durationSec * scale }}
                    >
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
