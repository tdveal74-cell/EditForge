import { AUDIO_HIERARCHY } from "./audio";

/**
 * The audio tracks are the audio ladder, not a separate list that happens to
 * resemble it — so a stem sheet built from a cut counts real clips, and the
 * timeline cannot grow a track the mix has no rule for.
 */
export type AudioTrack = (typeof AUDIO_HIERARCHY)[number]["track"];

export type TimelineClip = {
  id: string;
  label: string;
  track: "video" | AudioTrack;
  startSec: number;
  durationSec: number;
};

/** Render order: picture, then the ladder top-down. */
export const TRACK_ORDER: TimelineClip["track"][] = ["video", ...AUDIO_HIERARCHY.map((l) => l.track)];

export const SAMPLE_TIMELINE: TimelineClip[] = [
  { id: "v1", label: "A-cam cold open", track: "video", startSec: 0, durationSec: 12 },
  { id: "vo1", label: "Auren VO", track: "vo", startSec: 1, durationSec: 10 },
  { id: "s1", label: "Door latch", track: "sfx", startSec: 11.5, durationSec: 1.5 },
  { id: "m1", label: "Restraint score bed", track: "music", startSec: 0, durationSec: 14 },
  { id: "a1", label: "Room tone", track: "ambience", startSec: 0, durationSec: 15 },
  { id: "v2", label: "Still hold", track: "video", startSec: 12, durationSec: 3 },
];

export function totalDuration(clips: TimelineClip[]): number {
  return clips.reduce((max, c) => Math.max(max, c.startSec + c.durationSec), 0);
}

/** Read-only assembly as a file. Not an NLE. */
export function buildAssemblySketch(clips: TimelineClip[]): string {
  return (
    JSON.stringify(
      {
        kind: "assembly-sketch",
        notice:
          "Read-only assembly sketch as a file. Not an NLE, not Premiere, not Resolve, not DaVinci. You cannot trim here.",
        durationSec: totalDuration(clips),
        clips,
      },
      null,
      2,
    ) + "\n"
  );
}
