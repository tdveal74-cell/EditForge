/**
 * Media arithmetic — the parts of the viewing surfaces that can be wrong
 * without looking wrong.
 *
 * Frame positions and waveform buckets are the kind of code that produces a
 * plausible picture from bad maths: a filmstrip with the last frame missing
 * still looks like a filmstrip. Keeping the arithmetic here, pure, is what
 * makes those failures visible in a test rather than in a review session.
 */

/**
 * Evenly spaced sample times across a clip, inclusive of both ends.
 *
 * Inclusive matters: a filmstrip that omits the last frame is missing the
 * shot's out-point, which is exactly the frame an editor is looking for.
 */
export function frameTimesFor(durationSec: number, count: number): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || count <= 0) return [];
  if (count === 1) return [0];
  const step = durationSec / (count - 1);
  return Array.from({ length: count }, (_, i) => round(Math.min(i * step, durationSec)));
}

/**
 * Reduce a sample buffer to `buckets` peak magnitudes in 0..1.
 *
 * Peak, not average. Averaging a waveform flattens transients, and transients
 * are the whole reason anyone looks at a waveform — a clipped consonant or a
 * door slam disappears into an RMS curve.
 */
export function peaksFrom(samples: ArrayLike<number>, buckets: number): number[] {
  if (buckets <= 0 || samples.length === 0) return [];
  const size = samples.length / buckets;
  const out: number[] = [];
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * size);
    const end = Math.min(Math.floor((b + 1) * size), samples.length);
    let peak = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(samples[i]);
      if (v > peak) peak = v;
    }
    out.push(round(Math.min(peak, 1)));
  }
  return out;
}

/** `m:ss` for a duration in seconds. Timecode readers expect a padded field. */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Whether a URL is something a <video> element can be asked to play.
 *
 * A provider returning an image URL into a video slot should show as an
 * unsupported result, not as a silently black player.
 */
export function isPlayableVideo(url: string | undefined): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return [".mp4", ".webm", ".mov", ".m4v"].some((ext) => clean.endsWith(ext));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Whether a URL is something an <audio> element can be asked to play.
 *
 * Voice results are audio, and putting an mp3 in a <video> element renders a
 * black rectangle with sound — which reads as a broken render rather than a
 * finished take.
 */
export function isPlayableAudio(url: string | undefined): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return [".mp3", ".wav", ".m4a", ".ogg", ".aac"].some((ext) => clean.endsWith(ext));
}
