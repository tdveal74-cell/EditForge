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

export type GenSubmitRequest = {
  provider: GenProvider;
  mode: GenMode;
  prompt: string;
  tier: QualityTier;
  idempotencyKey: string;
};

export type GenSubmitResult =
  | {
      ok: true;
      provider: GenProvider;
      jobId: string;
      mode: "mock" | "live";
      status: "queued";
      note: string;
    }
  | {
      ok: false;
      provider: GenProvider;
      error: string;
      mode: "mock" | "live";
    };

/**
 * Single entry for gen-video execution boundary.
 * Live providers require env keys; without keys, only mock is allowed.
 * This is the one path CI and the UI must call — never ad-hoc provider SDKs.
 */
export function submitGenVideo(req: GenSubmitRequest): GenSubmitResult {
  const provider = pickProvider(req.provider);
  const meta = GEN_PROVIDERS.find((p) => p.id === provider)!;

  if (provider === "mock") {
    return {
      ok: true,
      provider: "mock",
      jobId: `mock-${req.idempotencyKey}`,
      mode: "mock",
      status: "queued",
      note: "Offline plan only — no cloud spend",
    };
  }

  const key = process.env[meta.envKey];
  if (!key) {
    return {
      ok: false,
      provider,
      mode: "live",
      error: `${meta.envKey} not configured — use mock or set the key for live path`,
    };
  }

  // Live path is intentionally a boundary stub: auth exists, worker/polling is next increment.
  return {
    ok: true,
    provider,
    jobId: `live-${provider}-${req.idempotencyKey}`,
    mode: "live",
    status: "queued",
    note: "Live credentials present — submit/poll worker not yet attached in this MVP",
  };
}

export function providerHasCredentials(provider: GenProvider): boolean {
  if (provider === "mock") return true;
  const meta = GEN_PROVIDERS.find((p) => p.id === provider);
  if (!meta?.envKey) return false;
  return Boolean(process.env[meta.envKey]);
}
