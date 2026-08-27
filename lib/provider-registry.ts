import type { JobKind } from "./jobs";

/**
 * Which providers exist, what each one's HTTP surface actually looks like, and
 * what it needs from the environment before it can be called.
 *
 * Pure on purpose. `lib/providers.ts` does the talking — it reaches the
 * filesystem to store bytes a provider hands back — and a client component that
 * only wants to draw a picker must not drag that in. So the registry lives here
 * and both the transport and the UI read from the same one; a picker cannot
 * offer a provider the boundary would refuse.
 */

export type ProviderMode = "mock" | "live";

/** Provider-side lifecycle, deliberately narrower than the studio's job states. */
export type ProviderState = "queued" | "running" | "succeeded" | "failed";

export type SubmitRequest = {
  provider: string;
  kind: JobKind;
  prompt: string;
  idempotencyKey: string;
  /** Provider-specific knobs (voiceId, avatarId, ratio…), passed through. */
  options?: Record<string, unknown>;
};

export type EnvLike = Record<string, string | undefined>;

/** Resolved per-request configuration a wire needs beyond the API key. */
export type WireSettings = Record<string, string>;

export type SettingsResult = { ok: true; value: WireSettings } | { ok: false; error: string };

export type PollReading = { state: ProviderState; result?: string; note?: string };

/**
 * Where a provider expects its credential.
 *
 * Not every provider takes a bearer token. ElevenLabs reads `xi-api-key` and
 * HeyGen reads `X-Api-Key`; sending either one an `Authorization` header gets a
 * 401 that looks exactly like a bad key. Making this explicit per provider is
 * what stops "the key is wrong" being the first guess when the header is.
 */
export type ProviderAuth = { header: string; scheme?: string };

/** What a wire gets when it does not name its own. */
export const DEFAULT_AUTH: ProviderAuth = { header: "Authorization", scheme: "Bearer" };

/**
 * How one provider's HTTP surface actually looks.
 *
 * There used to be no such thing: every live provider was submitted as
 * `POST {endpoint}/tasks {prompt}`, a shape no provider in this registry
 * implements. A provider is live only when it has one of these. That is what
 * makes `liveWired` a fact rather than a hope.
 */
export type ProviderWire = {
  /** Defaults to `Authorization: Bearer <key>`. */
  auth?: ProviderAuth;
  /** Headers this provider requires on every request, beyond auth and JSON. */
  headers?: Record<string, string>;
  /**
   * Everything from env and the studio brief this call needs, resolved once and
   * handed to the builders below. Returning `ok: false` refuses before any
   * request is made — an unset voice id should cost nothing.
   */
  settings?: (env: EnvLike, req: SubmitRequest) => SettingsResult;
  submitPath: (req: SubmitRequest, settings: WireSettings) => string;
  buildBody: (req: SubmitRequest, settings: WireSettings) => Record<string, unknown>;
  /** Pull the provider's own task id out of its submit envelope. */
  readSubmitId?: (data: unknown) => string | undefined;
  /** Absent only for `binary` providers, which have nothing to poll. */
  pollPath?: (externalId: string) => string;
  readPoll?: (data: unknown) => PollReading;
  /**
   * The submit answers with the media itself rather than a task id.
   *
   * There is no second request to make: the bytes are stored and the work is
   * already finished. `extension` is what the stored file is named.
   */
  binary?: { extension: string };
};

export type ProviderSpec = {
  id: string;
  kind: JobKind;
  label: string;
  /** Env var holding the credential; empty means the provider needs none. */
  envKey: string;
  /**
   * Other names the same credential is known by. Runway's own SDK reads
   * `RUNWAYML_API_SECRET`, and `compose.yaml` sets that name for the private
   * adapter — a studio that set it once should not have to set it twice under
   * a different name to make the control plane agree.
   */
  envAliases?: string[];
  /** Base endpoint for the live path. Absent means live is not wired yet. */
  endpoint?: string;
  /** Absent means the shape is not implemented — the boundary refuses. */
  wire?: ProviderWire;
  /** Extra env this provider needs before it can run, for readiness reporting. */
  settingKeys?: string[];
};

/**
 * Runway pins behaviour to a dated API version and rejects any request that
 * omits the header. Bumping this date is a deliberate migration, never a
 * silent follow-the-latest.
 */
const RUNWAY_API_VERSION = "2024-11-06";

/**
 * Runway carries the output resolution in `ratio`; aspect names are refused.
 * `text_to_video` offers landscape and portrait only — there is no square.
 */
const RUNWAY_RATIOS = ["1280:720", "720:1280"];
const RUNWAY_ASPECT_RATIOS: Record<string, string> = { "16:9": "1280:720", "9:16": "720:1280" };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * The ElevenLabs voice this studio voice maps to.
 *
 * `SAMPLE_VOICES` ids are the studio's own vocabulary — "vo-auren" means
 * nothing to ElevenLabs. Each studio voice can be pinned to a provider voice
 * with `ELEVENLABS_VOICE_ID_<SLUG>`, falling back to `ELEVENLABS_VOICE_ID`. A
 * caller that already knows the provider's id may pass it straight through.
 */
export function elevenLabsVoiceId(env: EnvLike, studioVoiceId: string): string {
  const asked = text(studioVoiceId);
  if (asked && !asked.startsWith("vo-")) return asked;
  const slug = asked.replace(/^vo-/, "").replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
  return text(slug ? env[`ELEVENLABS_VOICE_ID_${slug}`] : "") || text(env.ELEVENLABS_VOICE_ID);
}

export const PROVIDERS: ProviderSpec[] = [
  // Gen video
  {
    id: "runway",
    kind: "gen-video",
    label: "Runway",
    envKey: "RUNWAY_API_KEY",
    envAliases: ["RUNWAYML_API_SECRET"],
    endpoint: "https://api.dev.runwayml.com/v1",
    wire: {
      headers: { "X-Runway-Version": RUNWAY_API_VERSION },
      // The studio brief speaks in aspects and seconds; Runway speaks in output
      // resolutions and a 2-10s window. Translating here — and refusing what
      // does not translate — is the difference between a caught mistake and a
      // 400 from the provider. Unknown options are dropped rather than passed
      // through: Runway rejects a body carrying fields it does not define, so
      // spreading the studio's own brief into it made every live submit fail.
      settings: (_env, req) => {
        const asked = text(req.options?.ratio);
        const aspect = text(req.options?.aspect);
        if (asked && !RUNWAY_RATIOS.includes(asked)) {
          return { ok: false, error: `Runway ratio must be one of ${RUNWAY_RATIOS.join(", ")}` };
        }
        if (!asked && aspect && !RUNWAY_ASPECT_RATIOS[aspect]) {
          return {
            ok: false,
            error: `Runway text-to-video renders ${Object.keys(RUNWAY_ASPECT_RATIOS).join(" or ")}, not ${aspect}`,
          };
        }
        const duration = Number(req.options?.duration ?? req.options?.durationSec ?? 5);
        if (!Number.isInteger(duration) || duration < 2 || duration > 10) {
          return { ok: false, error: "Runway duration must be a whole number of seconds from 2 to 10" };
        }
        return {
          ok: true,
          value: {
            ratio: asked || RUNWAY_ASPECT_RATIOS[aspect] || RUNWAY_RATIOS[0],
            duration: String(duration),
          },
        };
      },
      // Creation is per-modality; there is no generic task-creation route.
      submitPath: () => "/text_to_video",
      buildBody: (req, settings) => ({
        model: text(req.options?.model) || "gen4.5",
        promptText: req.prompt,
        ratio: settings.ratio,
        duration: Number(settings.duration),
      }),
      pollPath: (id) => `/tasks/${encodeURIComponent(id)}`,
    },
  },
  { id: "kling", kind: "gen-video", label: "Kling", envKey: "KLING_API_KEY" },
  { id: "veo", kind: "gen-video", label: "Veo", envKey: "VEO_API_KEY" },
  { id: "seedream", kind: "gen-video", label: "Seedream", envKey: "SEEDREAM_API_KEY" },

  // Voice. Text-to-speech answers with the audio bytes themselves, so there is
  // no task id and nothing to poll — `binary` says so, and the boundary stores
  // what comes back instead of pretending a second request exists.
  {
    id: "elevenlabs",
    kind: "voice",
    label: "ElevenLabs",
    envKey: "ELEVENLABS_API_KEY",
    endpoint: "https://api.elevenlabs.io/v1",
    settingKeys: ["ELEVENLABS_VOICE_ID"],
    wire: {
      auth: { header: "xi-api-key" },
      binary: { extension: ".mp3" },
      settings: (env, req) => {
        const voiceId = elevenLabsVoiceId(env, text(req.options?.voiceId));
        if (!voiceId) {
          return {
            ok: false,
            error:
              "No ElevenLabs voice id for this voice — set ELEVENLABS_VOICE_ID, or ELEVENLABS_VOICE_ID_<VOICE> to pin one studio voice",
          };
        }
        if (!req.prompt.trim()) return { ok: false, error: "ElevenLabs needs a script to speak" };
        return {
          ok: true,
          value: {
            voiceId,
            modelId: text(req.options?.modelId) || "eleven_multilingual_v2",
            outputFormat: text(req.options?.outputFormat) || "mp3_44100_128",
          },
        };
      },
      submitPath: (_req, settings) =>
        `/text-to-speech/${encodeURIComponent(settings.voiceId)}?output_format=${encodeURIComponent(settings.outputFormat)}`,
      buildBody: (req, settings) => ({
        text: req.prompt,
        model_id: settings.modelId,
        voice_settings: {
          stability: clamp01(req.options?.stability, 0.5),
          similarity_boost: clamp01(req.options?.similarityBoost, 0.8),
          style: clamp01(req.options?.style, 0),
          use_speaker_boost: req.options?.useSpeakerBoost !== false,
        },
      }),
    },
  },

  // Avatar. HeyGen renders the talking head; EditForge owns the brief, the cut
  // linkage and the rubric gate.
  {
    id: "heygen",
    kind: "avatar",
    label: "HeyGen",
    envKey: "HEYGEN_API_KEY",
    endpoint: "https://api.heygen.com",
    settingKeys: ["HEYGEN_AVATAR_ID", "HEYGEN_VOICE_ID"],
    wire: {
      auth: { header: "X-Api-Key" },
      settings: (env, req) => {
        const avatarId = text(req.options?.avatarId) || text(env.HEYGEN_AVATAR_ID);
        const voiceId = text(req.options?.voiceId) || text(env.HEYGEN_VOICE_ID);
        if (!avatarId) return { ok: false, error: "HEYGEN_AVATAR_ID is not set — HeyGen needs the avatar look to render" };
        if (!voiceId) return { ok: false, error: "HEYGEN_VOICE_ID is not set — HeyGen needs a voice for the script" };
        return { ok: true, value: { avatarId, voiceId, title: text(req.options?.title) } };
      },
      submitPath: () => "/v3/videos",
      buildBody: (req, settings) => ({
        type: "avatar",
        avatar_id: settings.avatarId,
        voice_id: settings.voiceId,
        script: req.prompt,
        ...(settings.title ? { title: settings.title } : {}),
      }),
      // HeyGen wraps everything in `data`. Reading `id` off the envelope root
      // would find nothing and the submit would look like a provider that
      // answered without a task id.
      readSubmitId: (data) => {
        const envelope = record(record(data).data);
        return text(envelope.id) || text(envelope.video_id) || text(record(data).video_id) || undefined;
      },
      pollPath: (id) => `/v3/videos/${encodeURIComponent(id)}`,
      readPoll: (data) => {
        const envelope = record(record(data).data);
        const state = normalizeState(text(envelope.status));
        return {
          state,
          result: state === "succeeded" ? text(envelope.video_url) || undefined : undefined,
          note: state === "failed"
            ? text(envelope.failure_message) || text(envelope.error) || undefined
            : undefined,
        };
      },
    },
  },

  // Always available, never charges, never pretends.
  { id: "mock", kind: "gen-video", label: "Mock (offline)", envKey: "" },
];

function clamp01(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/** True when this provider has both a base endpoint and an implemented shape. */
export function isLiveWired(id: string): boolean {
  const p = findProvider(id);
  if (!p) return false;
  if (p.id === "mock") return true;
  return Boolean(p.endpoint && p.wire);
}

export function findProvider(id: string): ProviderSpec | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function providersFor(kind: JobKind): ProviderSpec[] {
  return PROVIDERS.filter((p) => p.kind === kind);
}

/**
 * Choices for a UI picker: the providers that serve this kind, then the offline
 * path, which serves every kind. Built from the same registry the boundary
 * dispatches on, so a picker cannot offer a provider that would be refused.
 */
export function providerChoicesFor(kind: JobKind): ProviderSpec[] {
  return [
    ...PROVIDERS.filter((p) => p.kind === kind && p.id !== "mock"),
    ...PROVIDERS.filter((p) => p.id === "mock"),
  ];
}

/** Every env name that would satisfy this provider's credential. */
export function credentialKeysFor(spec: ProviderSpec): string[] {
  return spec.envKey ? [spec.envKey, ...(spec.envAliases ?? [])] : [];
}

/** The credential value for this provider, under whichever name it was set. */
export function credentialFor(spec: ProviderSpec, env: EnvLike = process.env): string {
  for (const key of credentialKeysFor(spec)) {
    const value = text(env[key]);
    if (value) return value;
  }
  return "";
}

/** True when this provider could actually run live right now. */
export function hasCredentials(id: string, env: EnvLike = process.env): boolean {
  const p = findProvider(id);
  if (!p) return false;
  if (!p.envKey) return true;
  return Boolean(credentialFor(p, env));
}

/** Providers each spell their statuses differently; collapse to our four. */
export function normalizeState(raw?: string): ProviderState {
  const s = (raw ?? "").toLowerCase();
  if (["succeeded", "success", "completed", "complete", "done", "ready"].includes(s)) return "succeeded";
  if (["failed", "error", "cancelled", "canceled", "rejected"].includes(s)) return "failed";
  if (["running", "processing", "in_progress", "generating"].includes(s)) return "running";
  return "queued";
}
