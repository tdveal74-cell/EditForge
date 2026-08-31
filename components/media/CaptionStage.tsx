"use client";

import { useState } from "react";
import { cueAtTime, type CaptionCue } from "@/lib/captions";
import { formatTimecode, isPlayableVideo } from "@/lib/media";
import { MediaEmpty } from "./Viewer";

/**
 * Captions on a picture.
 *
 * The cue list is not the product — the overlay on the studio reference clip
 * is. Time comes from the player; the cue covering that instant sits on the
 * frame. Cues past the clip's duration do not appear.
 */
export function CaptionStage({
  src,
  cues,
  label,
}: {
  src?: string;
  cues: CaptionCue[];
  label?: string;
}) {
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const cue = cueAtTime(cues, time);

  if (!src || !isPlayableVideo(src)) {
    return (
      <MediaEmpty
        what="No picture to caption."
        how="The studio reference clip carries the overlay. Cues without a picture are a notepad."
      />
    );
  }

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-card border border-border bg-navy">
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="block max-h-[28rem] w-full object-contain"
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />
        {cue?.text ? (
          <p
            className="pointer-events-none absolute inset-x-0 bottom-10 mx-auto max-w-[90%] text-center text-sm font-medium leading-snug text-surface drop-shadow-[0_1px_2px_rgba(10,22,40,0.85)] sm:text-base"
            data-caption-overlay
          >
            {cue.text}
          </p>
        ) : null}
      </div>
      <figcaption className="mt-2 flex items-baseline justify-between gap-3 text-xs text-navy/50">
        <span>{label ?? "Caption overlay — studio reference clip, not a burned-in master"}</span>
        <span className="font-mono tabular-nums">
          {formatTimecode(time)} / {formatTimecode(duration)}
        </span>
      </figcaption>
    </figure>
  );
}
