export type CaptionCue = {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
};


/** Next cue after the last one. Empty text so the operator writes it. */
export function newCaptionCue(after?: CaptionCue): CaptionCue {
  const start = after && Number.isFinite(after.endSec) ? after.endSec : 0;
  return {
    id: `c-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    startSec: start,
    endSec: start + 2,
    text: "",
  };
}

export const SAMPLE_CUES: CaptionCue[] = [
  { id: "c1", startSec: 0, endSec: 2.5, text: "Where are we today?" },
  { id: "c2", startSec: 2.5, endSec: 6, text: "Inside the question we keep avoiding." },
  { id: "c3", startSec: 6, endSec: 10, text: "The shadow isn't the enemy." },
];

export function formatSrt(cues: CaptionCue[]): string {
  return cues
    .map((c, i) => {
      const a = toSrtTime(c.startSec);
      const b = toSrtTime(c.endSec);
      return `${i + 1}\n${a} --> ${b}\n${c.text}\n`;
    })
    .join("\n");
}

/** WebVTT from the same cue list. Milliseconds use a dot, unlike SRT. */
export function formatVtt(cues: CaptionCue[]): string {
  const body = cues
    .map((c) => {
      const a = toVttTime(c.startSec);
      const b = toVttTime(c.endSec);
      return `${a} --> ${b}\n${c.text}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

function toSrtTime(sec: number): string {
  return formatTime(sec, ",");
}

function toVttTime(sec: number): string {
  return formatTime(sec, ".");
}

function formatTime(sec: number, msSep: "," | "."): string {
  const n = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  const ms = Math.floor((n % 1) * 1000);
  const p = (v: number, w = 2) => String(v).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}${msSep}${p(ms, 3)}`;
}
