"use client";

import { useState } from "react";
import type { GradeParams } from "@/lib/grade";
import {
  GREY_RAMP,
  REFERENCE_PATCHES,
  gradeFilter,
  temperatureOverlay,
  vignetteGradient,
} from "@/lib/gradeCss";

/**
 * What the grade actually does, on screen.
 *
 * The sliders used to print numbers and change nothing, which made the
 * restraint envelope an assertion rather than something anyone could see.
 *
 * With no footage loaded this grades a reference chart rather than a
 * photograph, and that is the better default: a grade judged against one
 * picture is judged against that picture, while a ramp and a set of patches
 * tell you the blacks crushed or the skin went green. It is why bars go up
 * before a wheel is touched. Pass `src` and it grades the frame instead.
 */
export function GradePreview({ grade, src }: { grade: GradeParams; src?: string }) {
  const [split, setSplit] = useState(50);

  const filter = gradeFilter(grade);
  const temp = temperatureOverlay(grade);
  const vignette = vignetteGradient(grade);

  return (
    <figure className="m-0">
      <div className="relative aspect-video w-full overflow-hidden rounded-card border border-border bg-navy">
        {/* Ungraded, full width. The graded layer is clipped over it, so the
            wipe compares the same pixels rather than two scaled copies. */}
        <Frame src={src} />

        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
          aria-hidden
        >
          <div className="absolute inset-0" style={{ filter }}>
            <Frame src={src} />
          </div>
          {temp && (
            <div
              className="absolute inset-0 mix-blend-soft-light"
              style={{ backgroundColor: temp.color, opacity: temp.opacity }}
            />
          )}
          {vignette && <div className="absolute inset-0" style={{ background: vignette }} />}
        </div>

        {/* The wipe line, so the eye knows which side is which. */}
        <div
          aria-hidden
          className="absolute inset-y-0 w-px bg-amber/70"
          style={{ left: `${split}%` }}
        />
        <span className="absolute left-2 top-2 rounded-control bg-navy/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-surface/80">
          source
        </span>
        <span className="absolute right-2 top-2 rounded-control bg-navy/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber">
          graded
        </span>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Compare position</span>
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(e) => setSplit(Number(e.target.value))}
          className="w-full cursor-pointer accent-amber"
        />
      </label>

      <figcaption className="mt-1 text-xs text-navy/50">
        {src
          ? "Wipe to compare the graded frame against source."
          : "No footage loaded — grading a reference chart. Wipe to compare against source."}
      </figcaption>
    </figure>
  );
}

/** The thing being graded: real footage when there is any, the chart when not. */
function Frame({ src }: { src?: string }) {
  if (src) {
    // Arbitrary runtime URLs from provider renders — the optimiser cannot
    // pre-register hosts it will not see until a job returns.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="absolute inset-0 size-full object-cover" />;
  }
  return <ReferenceChart />;
}

function ReferenceChart() {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex flex-1">
        {GREY_RAMP.map((c) => (
          <div key={c} className="flex-1" style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="flex flex-[2]">
        {REFERENCE_PATCHES.map((p) => (
          <div
            key={p.label}
            className="flex flex-1 items-end p-1.5"
            style={{ backgroundColor: p.color }}
            title={`${p.label} — ${p.note}`}
          >
            <span className="font-mono text-[9px] leading-tight text-navy/70">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
