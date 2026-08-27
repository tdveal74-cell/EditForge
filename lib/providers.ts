import { artifactStoreConfigured, artifactUrl, storeArtifact } from "./artifacts";
import {
  DEFAULT_AUTH,
  credentialFor,
  credentialKeysFor,
  findProvider,
  normalizeState,
  type EnvLike,
  type PollReading,
  type ProviderMode,
  type ProviderSpec,
  type ProviderState,
  type SubmitRequest,
  type WireSettings,
} from "./provider-registry";

export * from "./provider-registry";

/**
 * The one execution boundary for AI media work.
 *
 * Every provider call in the studio goes through `submitToProvider` and
 * `pollProvider` — never an ad-hoc SDK call from a route. Three rules hold
 * regardless of provider:
 *
 *  1. Without credentials the boundary refuses rather than pretending. A mock
 *     run is always labelled `mode: "mock"` so nothing downstream can mistake
 *     it for rendered media.
 *  2. A submit that never reached the provider returns `ok: false`. It does not
 *     invent an external id.
 *  3. Anything a provider hands back as bytes is stored before the call is
 *     called a success. Paying for audio and then dropping it is worse than
 *     refusing to start.
 *
 * The registry it dispatches on lives in `lib/provider-registry.ts` and is
 * re-exported here, so existing importers keep one import path.
 */

export type SubmitResult =
  | {
      ok: true;
      provider: string;
      mode: ProviderMode;
      externalId: string;
      state: ProviderState;
      note: string;
      /**
       * Set only when the submit itself finished the work — a provider that
       * answers with the media rather than a task id. Carried here so the job
       * does not sit in `running` waiting on a poll for something already done.
       */
      result?: string;
    }
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

/** Credential header for this provider, however it wants to be given the key. */
function authHeaders(spec: ProviderSpec, env: EnvLike): Record<string, string> {
  const key = credentialFor(spec, env);
  if (!key) return {};
  const auth = spec.wire?.auth ?? DEFAULT_AUTH;
  return { [auth.header]: auth.scheme ? `${auth.scheme} ${key}` : key };
}

/** The refusal for a provider that has no key under any of its names. */
function missingCredential(spec: ProviderSpec): string {
  const keys = credentialKeysFor(spec);
  const names = keys.length > 1 ? `${keys.slice(0, -1).join(", ")} or ${keys[keys.length - 1]}` : keys[0];
  return `${names} not configured — set it or submit against the mock provider`;
}

type Ready = { spec: ProviderSpec; settings: WireSettings };

/**
 * Everything that must hold before a request is worth making.
 *
 * Deliberately ahead of the network call: an unset voice id, a ratio the
 * provider does not accept, or nowhere to put returned bytes are all cheaper to
 * catch here than after the provider has been paid.
 */
function prepare(req: SubmitRequest, env: EnvLike): Ready | { error: string; mode: ProviderMode } {
  const spec = findProvider(req.provider);
  if (!spec) return { error: `Unknown provider "${req.provider}"`, mode: "mock" };

  if (spec.kind !== req.kind && spec.id !== "mock") {
    return { error: `Provider ${spec.id} does not serve ${req.kind} work`, mode: "mock" };
  }
  if (spec.envKey && !credentialFor(spec, env)) {
    return { error: missingCredential(spec), mode: "live" };
  }
  if (!spec.endpoint || !spec.wire) {
    return {
      error: `${spec.label} has credentials but its API shape is not implemented here — use mock until it lands`,
      mode: "live",
    };
  }
  if (spec.wire.binary && !artifactStoreConfigured()) {
    return {
      error: `${spec.label} answers with the media itself and EDITFORGE_ARTIFACT_DIR is not set, so there is nowhere to keep it — configure the artifact store or run against mock`,
      mode: "live",
    };
  }

  const resolved = spec.wire.settings?.(env, req) ?? { ok: true as const, value: {} };
  if (!resolved.ok) return { error: `${spec.label}: ${resolved.error}`, mode: "live" };
  return { spec, settings: resolved.value };
}

export async function submitToProvider(req: SubmitRequest): Promise<SubmitResult> {
  const spec = findProvider(req.provider);

  if (spec?.id === "mock") {
    return {
      ok: true,
      provider: "mock",
      mode: "mock",
      externalId: mockId(req),
      state: "queued",
      note: "Offline plan only — no cloud spend, no rendered media",
    };
  }

  const ready = prepare(req, process.env);
  if ("error" in ready) {
    return { ok: false, provider: spec?.id ?? req.provider, mode: ready.mode, error: ready.error };
  }
  const { settings } = ready;
  const wire = ready.spec.wire!;

  try {
    const res = await fetch(`${ready.spec.endpoint}${wire.submitPath(req, settings)}`, {
      method: "POST",
      headers: {
        ...authHeaders(ready.spec, process.env),
        "Content-Type": "application/json",
        // Providers that honour it will dedupe a retried submit for us.
        "Idempotency-Key": req.idempotencyKey,
        ...(wire.headers ?? {}),
      },
      body: JSON.stringify(wire.buildBody(req, settings)),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        provider: ready.spec.id,
        mode: "live",
        error: `${ready.spec.label} submit failed: HTTP ${res.status}${await detail(res)}`,
      };
    }

    // The provider handed back the media rather than a task. Keep it, and let
    // the stored name stand in for an external id so the poll has something to
    // resolve. Storing before reporting success is the point: a failure here
    // must not read as a finished render.
    if (wire.binary) {
      const stored = await storeArtifact({
        bytes: await res.arrayBuffer(),
        extension: wire.binary.extension,
        prefix: `${ready.spec.id}-${req.kind}`,
      });
      return {
        ok: true,
        provider: ready.spec.id,
        mode: "live",
        externalId: stored.name,
        state: "succeeded",
        result: stored.url,
        note: `${ready.spec.label} returned ${stored.byteLength} bytes — stored as ${stored.name} (sha256 ${stored.sha256.slice(0, 12)}…)`,
      };
    }

    const data = (await res.json()) as { id?: string; task_id?: string };
    const externalId =
      wire.readSubmitId?.(data) ?? (typeof data.id === "string" ? data.id : undefined) ?? data.task_id;
    if (!externalId) {
      return { ok: false, provider: ready.spec.id, mode: "live", error: `${ready.spec.label} returned no task id` };
    }
    return {
      ok: true,
      provider: ready.spec.id,
      mode: "live",
      externalId,
      state: "queued",
      note: `Submitted to ${ready.spec.label}`,
    };
  } catch (err) {
    return { ok: false, provider: ready.spec.id, mode: "live", error: `${ready.spec.label} unreachable: ${(err as Error).message}` };
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

  if (spec.envKey && !credentialFor(spec, process.env)) {
    return { ok: false, provider: spec.id, mode: "live", error: `${credentialKeysFor(spec)[0]} not configured` };
  }
  if (!spec.endpoint || !spec.wire) {
    return { ok: false, provider: spec.id, mode: "live", error: `${spec.label} has no implemented API shape yet` };
  }

  // A binary provider finished at submit time. The work is the stored file, and
  // there is no upstream task to ask about.
  if (spec.wire.binary) {
    return {
      ok: true,
      provider: spec.id,
      mode: "live",
      state: "succeeded",
      result: artifactUrl(externalId),
      note: `${spec.label} audio stored as ${externalId}`,
    };
  }

  if (!spec.wire.pollPath) {
    return { ok: false, provider: spec.id, mode: "live", error: `${spec.label} has no poll route` };
  }

  try {
    const res = await fetch(`${spec.endpoint}${spec.wire.pollPath(externalId)}`, {
      headers: {
        ...authHeaders(spec, process.env),
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
    const data = await res.json();
    const reading: PollReading = spec.wire.readPoll?.(data) ?? defaultPoll(data);
    return {
      ok: true,
      provider: spec.id,
      mode: "live",
      state: reading.state,
      result: reading.result,
      note: reading.note,
    };
  } catch (err) {
    return { ok: false, provider: spec.id, mode: "live", error: `${spec.label} unreachable: ${(err as Error).message}` };
  }
}

/** The common `{status, output, failure}` shape, which Runway speaks. */
function defaultPoll(data: unknown): PollReading {
  const body = (data ?? {}) as { status?: string; output?: string | string[]; failure?: string };
  const state = normalizeState(body.status);
  const output = Array.isArray(body.output) ? body.output[0] : body.output;
  return {
    state,
    result: state === "succeeded" ? output : undefined,
    note: state === "failed" ? body.failure : undefined,
  };
}
