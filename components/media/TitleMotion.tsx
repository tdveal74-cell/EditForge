"use client";

import { useEffect, useRef, useState } from "react";
import { typedPrefix } from "@/lib/titles";
import { isPlayableVideo } from "@/lib/media";

/**
 * Type in motion on the frame.
 *
 * A navy box of finished text is a postcard, not a title. Web Animations
 * drives the progress; `typedPrefix` is what actually appears. Reduced
 * motion gets the whole string at once.
 */
export function TitleMotion({
  text,
  size,
  durationSec,
  src,
  poster,
}: {
  text: string;
  size: string;
  durationSec: number;
  src?: string;
  poster?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState("");
  const [gen, setGen] = useState(0);

  useEffect(() => {
    const el = stage.current;
    const full = text || "";
    if (!el) return;

    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !full) {
      setShown(full || "—");
      return;
    }

    setShown("");
    const duration = Math.max(600, (Number.isFinite(durationSec) ? durationSec : 3) * 1000);
    const anim = el.animate(
      [
        { opacity: 0.55, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" }
    );

    let raf = 0;
    const tick = () => {
      const effect = anim.effect;
      const progress =
        effect && "getComputedTiming" in effect
          ? Number((effect as KeyframeEffect).getComputedTiming().progress ?? 0)
          : 0;
      setShown(typedPrefix(full, progress));
      if (anim.playState === "running" || anim.playState === "pending") {
        raf = requestAnimationFrame(tick);
      } else {
        setShown(full);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      anim.cancel();
    };
  }, [text, durationSec, gen]);

  return (
    <div className="overflow-hidden rounded-card border border-border bg-navy">
      <div ref={stage} className="title-in-motion relative min-h-40">
        {src && isPlayableVideo(src) ? (
          <video
            src={src}
            poster={poster}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
            aria-hidden
          />
        ) : poster ? (
          // Frame still — next/image cannot pre-register a runtime poster.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        ) : null}
        <div className="relative flex min-h-40 items-center justify-center px-6 py-10">
          <p className={`${size} font-semibold tracking-tight text-surface drop-shadow-[0_1px_2px_rgba(10,22,40,0.8)]`}>
            {shown || "—"}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 px-3 py-1.5">
        <p className="text-[10px] uppercase tracking-wide text-surface/50">Type in motion — not After Effects</p>
        <button
          type="button"
          className="text-[11px] text-surface/70 hover:text-surface"
          onClick={() => setGen((n) => n + 1)}
        >
          Replay
        </button>
      </div>
    </div>
  );
}
