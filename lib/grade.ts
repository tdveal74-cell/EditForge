export type GradeParams = {
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  vignette: number;
};

export const DEFAULT_GRADE: GradeParams = {
  exposure: 0,
  contrast: 0.05,
  saturation: -0.05,
  temperature: 0.02,
  vignette: 0.08,
};

export function isRestraintGrade(g: GradeParams): boolean {
  const lim = 0.25;
  return (
    Math.abs(g.exposure) <= lim &&
    Math.abs(g.contrast) <= lim &&
    Math.abs(g.saturation) <= lim &&
    Math.abs(g.temperature) <= lim &&
    g.vignette >= 0 &&
    g.vignette <= 0.35
  );
}

export function gradeSummary(g: GradeParams): string {
  if (!isRestraintGrade(g)) return "Outside restraint envelope — pull back";
  return "Within restraint envelope";
}
