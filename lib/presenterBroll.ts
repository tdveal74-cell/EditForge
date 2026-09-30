export type PresenterBrand = "tqo" | "nco-forge";

export const PRESENTER_BRANDS: Record<
  PresenterBrand,
  { label: string; visualSystem: string; purpose: string }
> = {
  tqo: {
    label: "The Quiet Operator",
    purpose: "Calm, proof-driven guidance for mid-career professionals building quiet leverage.",
    visualSystem:
      "deep navy and warm off-white environment, sparse amber-gold accents, premium editorial realism, calm operational precision, no hype, no visible logos or text",
  },
  "nco-forge": {
    label: "NCO Forge",
    purpose: "Grounded leadership instruction shaped by senior NCO experience.",
    visualSystem:
      "charcoal, field olive, warm neutral light, disciplined leadership environment, practical military professionalism without costume or combat imagery, no visible logos or text",
  },
};

export const PRESENTER_SHOTS = [
  {
    id: "desk-review",
    label: "Desk review",
    direction:
      "Tee sits at a clean desk reviewing notes, then looks thoughtfully toward an off-camera monitor; subtle breathing, one natural hand movement, slow controlled camera push-in",
  },
  {
    id: "standing-explain",
    label: "Standing explanation",
    direction:
      "Tee stands beside a simple presentation wall and explains one idea with restrained hand movement; locked medium-wide composition and gentle parallax",
  },
  {
    id: "walk-and-think",
    label: "Walk and think",
    direction:
      "Tee walks slowly through a quiet professional workspace, pauses to consider a decision, then continues; smooth lateral camera movement and natural posture",
  },
  {
    id: "evidence-check",
    label: "Evidence check",
    direction:
      "Tee compares a printed page with information on a laptop, marks one finding, and gives a small confirming nod; observational over-shoulder movement",
  },
] as const;

export function presenterPrompt(input: {
  brand: PresenterBrand;
  shotId: string;
  motionNotes?: string;
}): string {
  const brand = PRESENTER_BRANDS[input.brand];
  const shot = PRESENTER_SHOTS.find((item) => item.id === input.shotId) ?? PRESENTER_SHOTS[0];
  const extra = input.motionNotes?.trim();

  return [
    "Preserve the exact identity, facial structure, age, skin tone, hair, and body proportions of the approved reference image.",
    shot.direction + ".",
    brand.visualSystem + ".",
    "Natural documentary motion, realistic hands, physically plausible movement, consistent clothing and face across every frame, no lip-sync, no speaking to camera, no morphing, no face drift, no extra fingers, no sudden camera motion.",
    extra ? `Additional direction: ${extra}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

