"use client";

import Image from "next/image";
import { TRACK_ORDER, totalDuration } from "@/lib/timeline";
import { PageHeader } from "@/components/PageHeader";
import { assembleNode01, node01Timeline } from "@/lib/assembly";
import { NODE01_VO } from "@/lib/masters";

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
  const clips = node01Timeline();
  const shots = assembleNode01();
  const dur = totalDuration(clips);
  // 22px/s rather than the 44 the sample used: this is a real 45s cut, and at
  // the old scale the ruler ran to 2,000px and the shape of it never fit on a
  // screen at once.
  const scale = 22;
  const ticks = Array.from({ length: Math.ceil(dur / 5) + 1 }, (_, i) => i * 5);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Assembly sketch"
        description="Read-only sketch of Node 01 — five picture masters against eleven narration lines. Not an NLE: you cannot trim, recut, or rearrange here. Picture is cut to the recorded read, so the runtime is the read."
        actions={
          <span className="rounded-control border border-border-faint bg-surface-elevated px-3 py-1.5 font-mono text-xs tabular-nums text-navy/60">
            {dur.toFixed(2)}s
          </span>
        }
      />

      {/* Shot strip. The tracks below carry duration and order but no picture,
          which is the one thing an assembly is actually read for — you scan the
          shots, not the bars.

          It used to sit apart from the timeline on the grounds that any mapping
          between shots and clips would be invented. That was true of two brand
          masters belonging to another show; it is not true of these. Each shot
          now carries the lines it plays over and the seconds that buys it, so
          the strip and the track below it describe the same cut.

          next/image because these are ~2MB masters; serving them raw into a
          112px-wide cell would ship 9MB to draw a filmstrip. */}
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wide text-navy/45">Shots — Node 01</h2>
        <ol className="mt-2 flex gap-2 overflow-x-auto pb-2">
          {shots.map(({ shot, lines, durationSec }) => (
            <li key={shot.id} className="w-28 shrink-0">
              <div className="relative aspect-[941/1672] overflow-hidden rounded-sm border border-border bg-surface-muted">
                <Image
                  src={shot.src}
                  alt={shot.label}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <p className="mt-1 font-mono text-[10px] tabular-nums text-navy/45">
                S{shot.shot} · {durationSec.toFixed(2)}s
              </p>
              <p className="font-mono text-[10px] tabular-nums text-navy/35">
                {lines.map((l) => `L${String(l.line).padStart(2, "0")}`).join(" ")}
              </p>
            </li>
          ))}
        </ol>
      </section>

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
                  {clips.filter((c) => c.track === track).map((c) => (
                    <div
                      key={c.id}
                      title={`${c.label} · ${c.startSec}s–${(c.startSec + c.durationSec).toFixed(2)}s`}
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

      {/* The empty rows above are the honest part. SFX, music and ambience carry
          nothing because nothing has been cut for them — the sample timeline
          drew a score bed, a door latch and room tone that never existed, which
          made the mix look three stems further along than it was. */}
      <p className="mt-6 max-w-prose text-xs leading-relaxed text-navy/50">
        Picture and narration are cut. {NODE01_VO.length} lines, {shots.length} shots,{" "}
        {dur.toFixed(2)}s. SFX, music and ambience are empty because none has been recorded —
        the rows stay on screen so the gap is visible rather than absent.
      </p>
    </main>
  );
}
