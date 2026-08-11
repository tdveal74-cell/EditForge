/** Premium restraint finishing checklist — EditForge core. */

export type RestraintCheck = {
  id: string;
  label: string;
  required: boolean;
};

export const RESTRAINT_RUBRIC: RestraintCheck[] = [
  { id: "subtle-grade", label: "Grade is subtle; no hero look", required: true },
  { id: "sound-hierarchy", label: "Tactile sound hierarchy clear", required: true },
  { id: "intentional-ending", label: "Intentional ending / still hold", required: true },
  { id: "minimal-titles", label: "Titles minimal; no template chrome", required: true },
  { id: "protect-quality", label: "Existing quality protected, not transformed", required: true },
];

export function allRequiredPass(results: Record<string, boolean>): boolean {
  return RESTRAINT_RUBRIC.filter((c) => c.required).every((c) => results[c.id] === true);
}
