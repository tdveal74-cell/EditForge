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

export type ParseCuesResult =
  | { ok: true; cues: CaptionCue[] }
  | { ok: false; reason: string };

/**
 * The cue list the operator edited, or a reason it is not one.
 *
 * Empty arrays are refused so a persist cannot wipe the picture overlay
 * down to nothing without meaning to.
 */
export function parseCaptionCues(raw: unknown): ParseCuesResult {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, reason: "At least one cue is required" };
  }
  const seen = new Set<string>();
  const cues: CaptionCue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { ok: false, reason: "Each cue must be an object" };
    }
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    if (!id) return { ok: false, reason: "Each cue needs an id" };
    if (seen.has(id)) return { ok: false, reason: `Duplicate cue "${id}"` };
    seen.add(id);
    const startSec = Number(row.startSec);
    const endSec = Number(row.endSec);
    if (!Number.isFinite(startSec) || startSec < 0) {
      return { ok: false, reason: `Cue "${id}" needs a start in seconds` };
    }
    if (!Number.isFinite(endSec) || endSec <= startSec) {
      return { ok: false, reason: `Cue "${id}" needs an end after its start` };
    }
    cues.push({
      id,
      startSec,
      endSec,
      text: String(row.text ?? ""),
    });
  }
  return { ok: true, cues };
}

/** Cue covering this instant, if any. End is exclusive so adjacent cues do not stack. */
export function cueAtTime(cues: CaptionCue[], timeSec: number): CaptionCue | null {
  if (!Number.isFinite(timeSec) || timeSec < 0) return null;
  return cues.find((c) => timeSec >= c.startSec && timeSec < c.endSec) ?? null;
}

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
