import { PROVIDERS, credentialKeysFor, hasCredentials, isLiveWired } from "./provider-registry";

export type GenProvider = "runway" | "kling" | "veo" | "seedream" | "mock";
export type GenMode = "text-to-video" | "image-to-video" | "extend" | "restyle";
export type QualityTier = "draft" | "social" | "broadcast-intent";

/**
 * What each gen-video provider is for, in studio terms.
 *
 * Only the editorial half lives here — which provider suits which shot. Which
 * env var holds the key, and whether the live path exists at all, comes from
 * `lib/provider-registry.ts`, because a second copy of that answer is a second
 * chance to disagree with the boundary that actually dispatches.
 */
const STRENGTHS: Record<GenProvider, string> = {
  runway: "Text-to-video only (Gen-4.5). Motion brush, restyle, and extend are not wired.",
  kling: "Registered — no live path implemented.",
  veo: "Registered — no live path implemented.",
  seedream: "Registered — no live path implemented.",
  mock: "Plan + QA only — no cloud spend, no media.",
};

export type GenProviderInfo = {
  id: GenProvider;
  label: string;
  strengths: string;
  envKey: string;
  /** Every name the credential may be set under. */
  envKeys: string[];
  /** Whether this provider's API shape is implemented at all. */
  liveWired: boolean;
};

export const GEN_PROVIDERS: GenProviderInfo[] = PROVIDERS.filter(
  (p) => p.kind === "gen-video"
).map((p) => ({
  id: p.id as GenProvider,
  label: p.label,
  strengths: STRENGTHS[p.id as GenProvider] ?? "",
  envKey: p.envKey,
  envKeys: credentialKeysFor(p),
  liveWired: isLiveWired(p.id),
}));

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

/**
 * Whether a gen-video provider could run right now.
 *
 * Execution itself is `submitToProvider` in `lib/providers.ts` — the one place
 * a provider is called. There used to be a `submitGenVideo` here too, returning
 * a `live-…` id and the note "worker not yet attached in this MVP": an id no
 * provider had issued, for work nothing had started. Nothing called it but its
 * own test, and a fabricated job id is precisely what this boundary exists to
 * prevent, so it is gone rather than kept as a second answer.
 */
export function providerReady(provider: GenProvider): boolean {
  if (provider === "mock") return true;
  return isLiveWired(provider) && hasCredentials(provider);
}
