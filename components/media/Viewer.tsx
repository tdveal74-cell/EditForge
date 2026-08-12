"use client";

import { useEffect, useRef, useState } from "react";
import { formatTimecode, frameTimesFor, isPlayableVideo, peaksFrom } from "@/lib/media";

/**
 * The viewing surfaces.
 *
 * Every one of these renders real media when it has any and says plainly that
 * it has none when it does not. There are no decorative stand-ins: a studio
 * tool that shows a picture of a waveform where a waveform should be teaches
 * the operator to distrust the screen, and that is worse than an empty box.
 */

/** Shared absence state — names what is missing and what would fill it. */
export function MediaEmpty({ what, how }: { what: string; how: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm text-navy/60">{what}</p>
      <p className="text-xs text-navy/40">{how}</p>
    </div>
  );
}

/**
 * Video review surface.
 *
 * Refuses a non-video URL rather than mounting a player that would sit black —
 * a provider handing back an image into a video slot is a real failure and
 * should read as one.
 */
export function VideoPlayer({
  src,
  poster,
  label,
}: {
  src?: string;
  poster?: string;
  label?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  if (!src) {
    return (
      <MediaEmpty
        what="No cut loaded for review."
        how="A completed render appears here once a job reaches validating."
      />
    );
  }

  if (!isPlayableVideo(src)) {
    return (
      <div className="rounded-card border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
        The provider returned something this player cannot open:{" "}
        <code className="break-all font-mono text-xs">{src}</code>
      </div>
    );
  }

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-card border border-border bg-navy">
        <video
          ref={ref}
          src={src}
          poster={poster}
          controls
          preload="metadata"
          className="block aspect-video w-full"
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />
      </div>
      <figcaption className="mt-2 flex items-baseline justify-between gap-3 text-xs text-navy/50">
        <span>{label ?? "Review"}</span>
        <span className="font-mono tabular-nums">
          {formatTimecode(time)} / {formatTimecode(duration)}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Filmstrip across a clip's duration.
 *
 * Frames are drawn from the video itself when one is loaded — seek, paint to a
 * canvas, move on — so the strip shows the actual cut rather than a stand-in.
 */
export function Filmstrip({ src, durationSec, count = 8 }: { src?: string; durationSec?: number; count?: number }) {
  const [frames, setFrames] = useState<string[]>([]);
  const times = frameTimesFor(durationSec ?? 0, count);

  useEffect(() => {
    if (!src || !isPlayableVideo(src) || times.length === 0) return;
    let cancelled = false;
    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.muted = true;

    const grab = async () => {
      const canvas = document.createElement("canvas");
      const out: string[] = [];
      for (const t of times) {
        if (cancelled) return;
        await new Promise<void>((resolve) => {
          const onSeek = () => {
            video.removeEventListener("seeked", onSeek);
            resolve();
          };
          video.addEventListener("seeked", onSeek);
          video.currentTime = t;
        });
        canvas.width = 160;
        canvas.height = Math.round((video.videoHeight / video.videoWidth) * 160) || 90;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          out.push(canvas.toDataURL("image/jpeg", 0.7));
        } catch {
          // A cross-origin frame taints the canvas. Nothing to show, and
          // guessing would be worse than an empty strip.
          return;
        }
      }
      if (!cancelled) setFrames(out);
    };

    video.addEventListener("loadeddata", grab, { once: true });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- times is derived
    // from the two values already listed; including the array would re-run
    // extraction on every render.
  }, [src, durationSec, count]);

  if (!src) {
    return (
      <MediaEmpty
        what="No footage to strip."
        how="Frames are sampled from the cut once one is attached."
      />
    );
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex w-max gap-1">
        {times.map((t, i) => (
          <div key={t} className="shrink-0">
            <div className="h-16 w-28 overflow-hidden rounded-sm border border-border bg-navy/10">
              {frames[i] ? (
                // eslint-disable-next-line @next/next/no-img-element -- a data:
                // URL painted from the loaded video; there is no remote to optimise.
                <img src={frames[i]} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full animate-pulse bg-surface-muted" />
              )}
            </div>
            <p className="mt-0.5 text-center font-mono text-[9px] tabular-nums text-navy/35">
              {formatTimecode(t)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Waveform from real audio.
 *
 * Decodes the file and draws its peaks. With no file it says so — a drawn
 * squiggle would be a picture of sound the operator does not have.
 */
export function Waveform({ src, buckets = 96 }: { src?: string; buckets?: number }) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        const buf = await res.arrayBuffer();
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audio = await new Ctx().decodeAudioData(buf);
        if (cancelled) return;
        setPeaks(peaksFrom(audio.getChannelData(0), buckets));
      } catch (err) {
        if (!cancelled) setFailed((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, buckets]);

  if (!src) {
    return (
      <MediaEmpty
        what="No audio attached."
        how="A voice render or an uploaded stem is drawn here from its own samples."
      />
    );
  }
  if (failed) {
    return (
      <p className="rounded-card border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not decode that audio: {failed}
      </p>
    );
  }
  if (!peaks) {
    return <div className="h-20 animate-pulse rounded-card border border-border bg-surface-muted" />;
  }

  return (
    <div
      className="flex h-20 items-center gap-px rounded-card border border-border bg-surface-elevated px-2"
      role="img"
      aria-label="Audio waveform"
    >
      {peaks.map((p, i) => (
        <span
          key={i}
          className="flex-1 rounded-full bg-navy/70"
          style={{ height: `${Math.max(2, p * 100)}%` }}
        />
      ))}
    </div>
  );
}

export type Shot = { id: string; label: string; poster?: string; status?: string };

/** Contact sheet. Real posters when present, a labelled slug when not. */
export function ThumbnailGrid({ shots }: { shots: Shot[] }) {
  if (shots.length === 0) {
    return (
      <MediaEmpty what="Nothing ingested yet." how="Shots appear here as they land in the store." />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {shots.map((s) => (
        <figure key={s.id} className="m-0">
          <div className="aspect-video overflow-hidden rounded-card border border-border bg-surface-muted">
            {s.poster ? (
              // eslint-disable-next-line @next/next/no-img-element -- runtime
              // provider URLs; hosts are not known at build time.
              <img src={s.poster} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center">
                <span className="font-mono text-[10px] uppercase tracking-widest text-navy/30">
                  no frame
                </span>
              </div>
            )}
          </div>
          <figcaption className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="truncate text-xs text-navy/70">{s.label}</span>
            {s.status && (
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-navy/35">
                {s.status}
              </span>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
