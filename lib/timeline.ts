export type TimelineClip = {
  id: string;
  label: string;
  track: "video" | "vo" | "music" | "sfx";
  startSec: number;
  durationSec: number;
};

export const SAMPLE_TIMELINE: TimelineClip[] = [
  { id: "v1", label: "A-cam cold open", track: "video", startSec: 0, durationSec: 12 },
  { id: "vo1", label: "Auren VO", track: "vo", startSec: 1, durationSec: 10 },
  { id: "m1", label: "Restraint score bed", track: "music", startSec: 0, durationSec: 14 },
  { id: "v2", label: "Still hold", track: "video", startSec: 12, durationSec: 3 },
];

export function totalDuration(clips: TimelineClip[]): number {
  return clips.reduce((max, c) => Math.max(max, c.startSec + c.durationSec), 0);
}
