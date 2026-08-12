import type { JobKind } from "./jobs";

/**
 * The one execution boundary for AI media work.
 *
 * Every provider call in the studio goes through `submitToProvider` and
 * `pollProvider` — never an ad-hoc SDK call from a route. Two rules hold
 * regardless of provider:
 *
 *  1. Without credentials the boundary refuses rather than pretending. A mock
 *     run is always labelled `mode: "mock"` so nothing downstream can mistake
 *     it for rendered media.
 *  2. A submit that never reached the provider returns `ok: false`. It does not
 *     invent an external id.
 */

export type ProviderMode = "mock" | "live";

/** Provider-side lifecycle, deliberately narrower than the studio's job states. */
export type ProviderState = "queued" | "running" | "succeeded" | "failed";

/**
 * How one provider's HTTP surface actually looks.
 *
 * There used to be no such thing: every live provider was submitted as
 * `POST {endpoint}/tasks {prompt}`, a shape no provider in this registry
 * implements. Runway rejected it with a 400 and ElevenLabs has no `/tasks`
 * route at all, so the live path had never once succeeded for anybody — it was
 * only ever reached with credentials configured, which no test does.
 *
 * A provider is live only when it has one of these. That is what makes
 * `liveWired` a fact rather than a hope.
 */
export type ProviderWire = {
  /** Headers this provider requires on every request, beyond auth and JSON. */
  headers?: Record<string, string>;
  /** Path appended to `endpoint` to create work. */
  submitPath: string;
  buildBody: (req: SubmitRequest) => Record<string, unknown>;
  pollPath: (externalId: string) => string;
};

export type ProviderSpec = {
  id: string;
  kind: JobKind;
  label: string;
  /** Env var holding the credential; empty means the provider needs none. */
  envKey: string;
  /** Base endpoint for the live path. Absent means live is not wired yet. */
  endpoint?: string;
  /** Absent means the shape is not implemented — the boundary refuses. */
  wire?: ProviderWire;
};

/**
 * Runway pins behaviour to a dated API version and rejects any request that
 * omits the header. Bumping this date is a deliberate migration, never a
 * silent follow-the-latest.
 */
const RUNWAY_API_VERSION = "2024-11-06";

export const PROVIDERS: ProviderSpec[] = [
  // Gen video
  {
    id: "runway",
    kind: "gen-video",
    label: "Runway",
    envKey: "RUNWAY_API_KEY",
    endpoint: "https://api.dev.runwayml.com/v1",
    wire: {
      headers: { "X-Runway-Version": RUNWAY_API_VERSION },
      // Creation is per-modality; there is no generic task-creation route.
      submitPath: "/text_to_video",
      buildBody: (req) => ({
        model: "gen4.5",
        promptText: req.prompt,
        // Since 2024-11-06 `ratio` carries the output resolution itself rather
        // than an aspect name — "16:9" is refused.
        ratio: "1280:720",
        duration: 5,
        ...(req.options ?? {}),
      }),
      pollPath: (id) => `/tasks/${encodeURIComponent(id)}`,
    },
  },
  { id: "kling", kind: "gen-video", label: "Kling", envKey: "KLING_API_KEY" },
  { id: "veo", kind: "gen-video", label: "Veo", envKey: "VEO_API_KEY" },
  { id: "seedream", kind: "gen-video", label: "Seedream", envKey: "SEEDREAM_API_KEY" },
  // Voice. Deliberately no wire: ElevenLabs text-to-speech answers a POST with
  // the audio bytes themselves, synchronously. There is no task to poll and
  // nowhere here to put a binary body, so it does not fit this submit-and-poll
  // boundary without somewhere to store the blob. Leaving the endpoint recorded
  // and the wire absent is the honest state — it refuses instead of issuing a
  // request that would 404.
  { id: "elevenlabs", kind: "voice", label: "ElevenLabs", envKey: "ELEVENLABS_API_KEY", endpoint: "https://api.elevenlabs.io/v1" },
  // Avatar — driven through the connected HyperFrames tools, not an API key here.
  { id: "hyperframes", kind: "avatar", label: "HyperFrames / HeyGen", envKey: "" },
  // Always available, never charges, never pretends.
  { id: "mock", kind: "gen-video", label: "Mock (offline)", envKey: "" },
];

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

/** True when this provider could actually run live right now. */
export function hasCredentials(id: string): boolean {
  const p = findProvider(id);
  if (!p) return false;
  if (!p.envKey) return true;
  return Boolean(process.env[p.envKey]);
}

export type SubmitRequest = {
  provider: string;
  kind: JobKind;
  prompt: string;
  idempotencyKey: string;
  /** Provider-specific knobs (aspect, duration, voiceId…), passed through. */
  options?: Record<string, unknown>;
};

export type SubmitResult =
  | { ok: true; provider: string; mode: ProviderMode; externalId: string; state: ProviderState; note: string }
  | { ok: false; provider: string; mode: ProviderMode; error: string };

export type PollResult =
  | { ok: true; provider: string; mode: ProviderMode; state: ProviderState; result?: string; note?: string }
  | { ok: false; provider: string; mode: ProviderMode; error: string };

/**
 * The provider's own words about why it refused.
 *
 * A bare `HTTP 400` is unactionable — it cost a source read to learn that the
 * submit was malformed rather than unauthorised. Providers explain themselves in
 * the response body; carrying a slice of it into the job record is the
 * difference between a debuggable failure and a mystery. Truncated because this
 * lands in a stored job note, and bodies can be long.
 */
async function detail(res: Response): Promise<string> {
  try {
    const body = (await res.text()).trim();
    if (!body) return "";
    return ` — ${body.length > 300 ? `${body.slice(0, 300)}…` : body}`;
  } catch {
    return "";
  }
}

/** Deterministic id for the offline path — same key in, same id out. */
function mockId(req: SubmitRequest): string {
  return `mock-${req.kind}-${req.idempotencyKey}`;
}

export async function submitToProvider(req: SubmitRequest): Promise<SubmitResult> {
  const spec = findProvider(req.provider);
  if (!spec) {
    return { ok: false, provider: req.provider, mode: "mock", error: `Unknown provider "${req.provider}"` };
  }
  if (spec.kind !== req.kind && spec.id !== "mock") {
    return {
      ok: false,
      provider: spec.id,
      mode: "mock",
      error: `Provider ${spec.id} does not serve ${req.kind} work`,
    };
  }

  if (spec.id === "mock") {
    return {
      ok: true,
      provider: "mock",
      mode: "mock",
      externalId: mockId(req),
      state: "queued",
      note: "Offline plan only — no cloud spend, no rendered media",
    };
  }

  if (spec.envKey && !process.env[spec.envKey]) {
    return {
      ok: false,
      provider: spec.id,
      mode: "live",
      error: `${spec.envKey} not configured — set it or submit against the mock provider`,
    };
  }

  if (!spec.endpoint || !spec.wire) {
    return {
      ok: false,
      provider: spec.id,
      mode: "live",
      error: `${spec.label} has credentials but its API shape is not implemented here — use mock until it lands`,
    };
  }

  try {
    const res = await fetch(`${spec.endpoint}${spec.wire.submitPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env[spec.envKey]}`,
        "Content-Type": "application/json",
        // Providers that honour it will dedupe a retried submit for us.
        "Idempotency-Key": req.idempotencyKey,
        ...(spec.wire.headers ?? {}),
      },
      body: JSON.stringify(spec.wire.buildBody(req)),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        provider: spec.id,
        mode: "live",
        error: `${spec.label} submit failed: HTTP ${res.status}${await detail(res)}`,
      };
    }
    const data = (await res.json()) as { id?: string; task_id?: string };
    const externalId = data.id ?? data.task_id;
    if (!externalId) {
      return { ok: false, provider: spec.id, mode: "live", error: `${spec.label} returned no task id` };
    }
    return { ok: true, provider: spec.id, mode: "live", externalId, state: "queued", note: `Submitted to ${spec.label}` };
  } catch (err) {
    return { ok: false, provider: spec.id, mode: "live", error: `${spec.label} unreachable: ${(err as Error).message}` };
  }
}

export async function pollProvider(provider: string, externalId: string): Promise<PollResult> {
  const spec = findProvider(provider);
  if (!spec) return { ok: false, provider, mode: "mock", error: `Unknown provider "${provider}"` };

  if (spec.id === "mock") {
    // The offline path settles immediately and says plainly that it produced
    // no media — a mock must never look like a finished render.
    return {
      ok: true,
      provider: "mock",
      mode: "mock",
      state: "succeeded",
      note: "Mock run — no media produced",
    };
  }

  if (spec.envKey && !process.env[spec.envKey]) {
    return { ok: false, provider: spec.id, mode: "live", error: `${spec.envKey} not configured` };
  }
  if (!spec.endpoint || !spec.wire) {
    return { ok: false, provider: spec.id, mode: "live", error: `${spec.label} has no implemented API shape yet` };
  }

  try {
    const res = await fetch(`${spec.endpoint}${spec.wire.pollPath(externalId)}`, {
      headers: {
        Authorization: `Bearer ${process.env[spec.envKey]}`,
        // The version header is required on every request, polls included — a
        // poll that omitted it would 400 just as the submit did.
        ...(spec.wire.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        provider: spec.id,
        mode: "live",
        error: `${spec.label} poll failed: HTTP ${res.status}${await detail(res)}`,
      };
    }
    const data = (await res.json()) as { status?: string; output?: string | string[]; failure?: string };
    const state = normalizeState(data.status);
    const output = Array.isArray(data.output) ? data.output[0] : data.output;
    return {
      ok: true,
      provider: spec.id,
      mode: "live",
      state,
      result: state === "succeeded" ? output : undefined,
      note: state === "failed" ? data.failure : undefined,
    };
  } catch (err) {
    return { ok: false, provider: spec.id, mode: "live", error: `${spec.label} unreachable: ${(err as Error).message}` };
  }
}

/** Providers each spell their statuses differently; collapse to our four. */
export function normalizeState(raw?: string): ProviderState {
  const s = (raw ?? "").toLowerCase();
  if (["succeeded", "success", "completed", "complete", "done", "ready"].includes(s)) return "succeeded";
  if (["failed", "error", "cancelled", "canceled", "rejected"].includes(s)) return "failed";
  if (["running", "processing", "in_progress", "generating"].includes(s)) return "running";
  return "queued";
}
