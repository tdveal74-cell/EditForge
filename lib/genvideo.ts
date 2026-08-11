export type GenProvider = "runway" | "kling" | "veo" | "seedream" | "mock";
export type GenMode = "text-to-video" | "image-to-video" | "extend" | "restyle";
export type QualityTier = "draft" | "social" | "broadcast-intent";

export const GEN_PROVIDERS: {
  id: GenProvider;
  label: string;
  strengths: string;
  envKey: string;
}[] = [
  { id: "runway", label: "Runway", strengths: "Gen-3 / motion brush · restyle · extend", envKey: "RUNWAY_API_KEY" },
  { id: "kling", label: "Kling", strengths: "Longer takes · strong motion coherence", envKey: "KLING_API_KEY" },
  { id: "veo", label: "Veo", strengths: "High fidelity · cinematic intent", envKey: "VEO_API_KEY" },
  { id: "seedream", label: "Seedream", strengths: "Stylized · concept-heavy looks", envKey: "SEEDREAM_API_KEY" },
  { id: "mock", label: "Mock (offline)", strengths: "Plan + QA only — no cloud spend", envKey: "" },
];

export const GEN_QUALITY_BAR = [
  "No random morphing faces on hero talent without review",
  "Motion must serve story — not demo the model",
  "Prefer locked framing for VO beds",
  "Grain / grade inside restraint envelope after gen",
  "Rubric pass before master ship",
  "License + disclosure when gen is used",
] as const;

export function pickProvider(requested?: string): GenProvider {
  const id = (requested || "mock") as GenProvider;
  return GEN_PROVIDERS.some((p) => p.id === id) ? id : "mock";
}
