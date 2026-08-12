import type { GradeParams } from "./grade";

/**
 * The grade, expressed as something a browser can render.
 *
 * `lib/grade.ts` decides whether a grade is *permitted*; this decides what it
 * *looks like*. Keeping the mapping here — pure, and returning strings rather
 * than touching the DOM — means the look can be asserted in a test instead of
 * being judged by eye, which is the only way a "subtle grade" rule survives
 * more than one person editing it.
 *
 * The parameters are normalised -0.5..0.5 (vignette 0..0.5); CSS filters are
 * multipliers around 1. Every conversion below is that translation and nothing
 * more clever — a grade the studio can predict is worth more than one that is
 * cleverly non-linear.
 */

/** Filters that apply to the image itself. */
export function gradeFilter(g: GradeParams): string {
  const parts = [
    `brightness(${round(1 + g.exposure)})`,
    `contrast(${round(1 + g.contrast)})`,
    `saturate(${round(1 + g.saturation)})`,
  ];
  return parts.join(" ");
}

/**
 * Temperature is a colour cast, not a filter — CSS has no white-balance
 * primitive, and hue-rotate would swing the whole wheel rather than warm or
 * cool it. A tinted overlay in `soft-light` is what a warming/cooling gel
 * actually does to a frame.
 */
export function temperatureOverlay(g: GradeParams): { color: string; opacity: number } | null {
  if (g.temperature === 0) return null;
  const warm = g.temperature > 0;
  return {
    // Warm toward tungsten amber, cool toward daylight blue.
    color: warm ? "#F5A623" : "#4A90D9",
    // Full-scale temperature is a strong gel, not an opaque wash.
    opacity: round(Math.min(Math.abs(g.temperature), 0.5) * 0.6),
  };
}

/**
 * Vignette as a radial falloff. Starts at 55% of the radius so the subject is
 * untouched and only the corners carry it — a vignette that darkens the face
 * is not restraint, it is a filter.
 */
export function vignetteGradient(g: GradeParams): string | null {
  if (g.vignette <= 0) return null;
  const strength = round(Math.min(g.vignette, 0.5));
  return `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`;
}

/** Two decimal places: enough precision to see, few enough to diff. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Reference chart patches — a grey ramp plus the colours a grade breaks first.
 *
 * A grade judged against a photograph is judged against that photograph. A
 * chart is what tells you the shadows crushed or the skin went green, and it
 * is the reason a colourist puts bars up before touching a wheel.
 */
export const GREY_RAMP = ["#000000", "#2B2B2B", "#555555", "#808080", "#AAAAAA", "#D4D4D4", "#FFFFFF"];

export const REFERENCE_PATCHES: { label: string; color: string; note: string }[] = [
  { label: "Skin, light", color: "#E8BFA0", note: "goes green or magenta first" },
  { label: "Skin, deep", color: "#8D5A3B", note: "loses separation when contrast climbs" },
  { label: "Sky", color: "#7BA7C7", note: "shows a cool push immediately" },
  { label: "Foliage", color: "#5C7A4A", note: "the first thing over-saturation ruins" },
  { label: "Neutral", color: "#808080", note: "any cast at all shows here" },
];
