/**
 * The studio's real media.
 *
 * Every media surface in this app — the player, the filmstrip, the waveform,
 * the contact sheet, the grade comparison — was built against nothing, and each
 * one drew its own empty state instead. They work; there was simply no footage
 * to point them at.
 *
 * These are real files in `public/media`, so the filmstrip decodes real frames,
 * the waveform reads a real audio track, and the grade is judged against a real
 * frame rather than a swatch. Durations and dimensions below were read out of
 * the containers, not estimated — a filmstrip spaces its frames across the
 * duration it is told, so a wrong number here shows up as a strip that stops
 * early or repeats the last frame.
 */

export type MediaAsset = {
  id: string;
  /** Path under `public/`. */
  src: string;
  kind: "video" | "image";
  label: string;
  /** Read from the container. Video only. */
  durationSec?: number;
  width: number;
  height: number;
  /** What this asset is for, in the studio's terms. */
  note: string;
};

export const MEDIA: MediaAsset[] = [
  {
    id: "rain-a",
    src: "/media/rain_street_night_a.mp4",
    kind: "video",
    label: "Rain street, night — A",
    durationSec: 15.07,
    width: 720,
    height: 1280,
    note: "Vertical master. The long take: enough runtime for a filmstrip to show change rather than repeat.",
  },
  {
    id: "rain-b",
    src: "/media/rain_street_night_b.mp4",
    kind: "video",
    label: "Rain street, night — B",
    durationSec: 8.06,
    width: 720,
    height: 1280,
    note: "Vertical alt. Shorter coverage of the same set-up.",
  },
  {
    id: "rain-still",
    src: "/media/rain_street_still.png",
    kind: "image",
    label: "Rain street — reference frame",
    width: 2560,
    height: 1440,
    note: "Landscape still. The grade reference: wet asphalt, sodium practicals, deep shadow — the three things a grade breaks first.",
  },
];

export function assetById(id: string): MediaAsset | undefined {
  return MEDIA.find((m) => m.id === id);
}

/** The clip a surface should reach for when it just needs one. */
export const PRIMARY_CLIP = MEDIA[0];

/** The frame the grade is judged against. */
export const REFERENCE_STILL = MEDIA[2];

export function videos(): MediaAsset[] {
  return MEDIA.filter((m) => m.kind === "video");
}

/**
 * Is this note's timestamp actually inside the clip?
 *
 * The sample notes were written at 00:01:12, 00:04:40 and 00:09:58 against no
 * media at all. Pointed at a 15-second clip, every one of them seeks past the
 * end — the player clamps, nothing appears to happen, and the reviewer concludes
 * the notes are broken. A note outside its clip is a bug in the note.
 */
export function noteIsInRange(atSeconds: number, durationSec?: number): boolean {
  if (durationSec === undefined) return true;
  return atSeconds >= 0 && atSeconds <= durationSec;
}
