export type CaptionCue = {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
};

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

function toSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(ms, 3)}`;
}
