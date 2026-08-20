import type { ExecutionClass } from "./spend-policy";

export type Engine = "persona" | "cinema" | "edit";
export type CapabilityState =
  | "ready-local"
  | "adapter-ready"
  | "gpu-required"
  | "disabled-paid";

export type ProviderId =
  | "liveportrait"
  | "musetalk"
  | "chatterbox"
  | "whisper"
  | "ltx"
  | "ffmpeg"
  | "remotion"
  | "heygen"
  | "kling"
  | "runway";

export type ProviderCapability = {
  provider: ProviderId;
  label: string;
  engines: readonly Engine[];
  executionClass: ExecutionClass;
  state: CapabilityState;
  functions: readonly string[];
  honestLimit: string;
};

export const ENGINE_CAPABILITIES: readonly ProviderCapability[] = [
  {
    provider: "liveportrait",
    label: "LivePortrait",
    engines: ["persona"],
    executionClass: "free-local",
    state: "gpu-required",
    functions: ["portrait animation", "head pose transfer", "facial expression transfer"],
    honestLimit: "Open software; production speed and resolution depend on available GPU compute",
  },
  {
    provider: "musetalk",
    label: "MuseTalk",
    engines: ["persona"],
    executionClass: "free-local",
    state: "gpu-required",
    functions: ["audio-driven lip sync", "talking-head repair"],
    honestLimit: "Open software; requires a compatible GPU worker for practical production",
  },
  {
    provider: "chatterbox",
    label: "Chatterbox",
    engines: ["persona"],
    executionClass: "free-local",
    state: "gpu-required",
    functions: ["consented voice cloning", "text-to-speech", "voice provenance marking"],
    honestLimit: "Use only with documented consent; compute is not free merely because software is open",
  },
  {
    provider: "whisper",
    label: "Whisper",
    engines: ["persona", "edit"],
    executionClass: "free-local",
    state: "ready-local",
    functions: ["transcription", "caption timing", "dialogue alignment"],
    honestLimit: "Long or high-volume transcription may require a worker rather than the browser",
  },
  {
    provider: "ltx",
    label: "LTX",
    engines: ["cinema", "edit"],
    executionClass: "free-local",
    state: "gpu-required",
    functions: [
      "text-to-video",
      "image-to-video",
      "video-to-video",
      "reference-conditioned generation",
      "synchronized audio-video generation",
    ],
    honestLimit: "Free software path, but cinematic generation still requires substantial GPU memory and time",
  },
  {
    provider: "ffmpeg",
    label: "FFmpeg",
    engines: ["edit"],
    executionClass: "free-local",
    state: "ready-local",
    functions: ["trim", "stitch", "transcode", "mix", "caption burn-in", "4K master export"],
    honestLimit: "4K export cannot create missing source detail; it only preserves or scales available media",
  },
  {
    provider: "remotion",
    label: "Remotion",
    engines: ["edit"],
    executionClass: "free-local",
    state: "ready-local",
    functions: ["timeline composition", "motion graphics", "titles", "episode batching", "4K layouts"],
    honestLimit: "Composition is local; generative source shots still require an inference engine",
  },
  {
    provider: "heygen",
    label: "HeyGen adapter",
    engines: ["persona"],
    executionClass: "paid-remote",
    state: "disabled-paid",
    functions: ["hosted avatar generation", "hosted translation", "hosted voice and lip sync"],
    honestLimit: "Disabled in zero-cost mode",
  },
  {
    provider: "kling",
    label: "Kling adapter",
    engines: ["cinema", "edit"],
    executionClass: "paid-remote",
    state: "disabled-paid",
    functions: [
      "text-to-video",
      "image-to-video",
      "start and end frames",
      "motion control",
      "multi-image reference",
      "shot extension",
      "multimodal video editing",
      "native audio",
    ],
    honestLimit: "Adapter contract only until billing is explicitly enabled and the live API is verified",
  },
  {
    provider: "runway",
    label: "Runway adapter",
    engines: ["persona", "cinema", "edit"],
    executionClass: "paid-remote",
    state: "disabled-paid",
    functions: [
      "text-to-video",
      "image-to-video",
      "reference consistency",
      "performance capture",
      "keyframed generative editing",
      "video-to-video",
      "background and object editing",
      "upscaling",
    ],
    honestLimit: "Disabled in zero-cost mode; output cost must be estimated before each submission",
  },
] as const;

export function capabilitiesFor(engine: Engine): readonly ProviderCapability[] {
  return ENGINE_CAPABILITIES.filter((item) => item.engines.includes(engine));
}

export function zeroCostProviders(engine: Engine): readonly ProviderCapability[] {
  return capabilitiesFor(engine).filter((item) => item.executionClass !== "paid-remote");
}

export function paidProvidersAreDisabled(): boolean {
  return ENGINE_CAPABILITIES.filter((item) => item.executionClass === "paid-remote").every(
    (item) => item.state === "disabled-paid",
  );
}
