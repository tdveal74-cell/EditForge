import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findProvider,
  hasCredentials,
  isLiveWired,
  normalizeState,
  pollProvider,
  providerChoicesFor,
  providersFor,
  submitToProvider,
} from "./providers";

const KEYS = [
  "RUNWAY_API_KEY",
  "RUNWAY_COST_PER_SECOND_USD",
  "KLING_API_KEY",
  "VEO_API_KEY",
  "SEEDREAM_API_KEY",
  "ELEVENLABS_API_KEY",
  "EDITFORGE_SPEND_MODE",
  "EDITFORGE_BILLING_ENABLED",
  "EDITFORGE_TOTAL_BUDGET_USD",
  "EDITFORGE_SPENT_USD",
  "EDITFORGE_PER_JOB_LIMIT_USD",
];

function clearKeys() {
  for (const k of KEYS) delete process.env[k];
}

function enableRunwaySpend() {
  process.env.EDITFORGE_SPEND_MODE = "controlled";
  process.env.EDITFORGE_BILLING_ENABLED = "true";
  process.env.EDITFORGE_TOTAL_BUDGET_USD = "10";
  process.env.EDITFORGE_SPENT_USD = "0";
  process.env.EDITFORGE_PER_JOB_LIMIT_USD = "1";
  process.env.RUNWAY_COST_PER_SECOND_USD = "0.05";
}

afterEach(() => {
  clearKeys();
  vi.unstubAllGlobals();
});

describe("provider boundary", () => {
  it("routes providers by the kind of work they serve", () => {
    expect(providersFor("voice").map((p) => p.id)).toContain("elevenlabs");
    expect(providersFor("avatar").map((p) => p.id)).toContain("hyperframes");
    expect(providersFor("gen-video").map((p) => p.id)).toEqual(
      expect.arrayContaining(["runway", "kling", "veo", "seedream"])
    );
  });

  it("refuses a provider asked to do work it does not serve", async () => {
    clearKeys();
    const res = await submitToProvider({
      provider: "elevenlabs",
      kind: "gen-video",
      prompt: "x",
      idempotencyKey: "k1",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("does not serve");
  });

  it("mock submits deterministically and never claims to have made media", async () => {
    const a = await submitToProvider({ provider: "mock", kind: "gen-video", prompt: "x", idempotencyKey: "same" });
    const b = await submitToProvider({ provider: "mock", kind: "gen-video", prompt: "x", idempotencyKey: "same" });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.externalId).toBe(b.externalId);

    const polled = await pollProvider("mock", "mock-gen-video-same");
    expect(polled.ok).toBe(true);
    if (polled.ok) {
      expect(polled.mode).toBe("mock");
      expect(polled.state).toBe("succeeded");
      // The crucial part: a mock must not look like a finished render.
      expect(polled.result).toBeUndefined();
      expect(polled.note).toMatch(/no media/i);
    }
  });

  it("fails closed without credentials, and does not invent an external id", async () => {
    clearKeys();
    const res = await submitToProvider({
      provider: "runway",
      kind: "gen-video",
      prompt: "x",
      idempotencyKey: "k2",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.mode).toBe("live");
      expect(res.error).toContain("RUNWAY_API_KEY");
    }
    expect(res).not.toHaveProperty("externalId");
  });

  it("refuses a credentialled provider whose API shape is not implemented", async () => {
    clearKeys();
    process.env.KLING_API_KEY = "tok";
    const res = await submitToProvider({ provider: "kling", kind: "gen-video", prompt: "x", idempotencyKey: "k3" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not implemented/i);
  });

  it("refuses ElevenLabs, which has an endpoint but no implemented shape", async () => {
    // It used to be submitted as POST /v1/tasks, a route ElevenLabs does not
    // have — text-to-speech answers with audio bytes synchronously and there is
    // no task to poll. Refusing beats issuing a request that 404s.
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "tok";
    const res = await submitToProvider({ provider: "elevenlabs", kind: "voice", prompt: "x", idempotencyKey: "k4" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not implemented/i);
  });

  it("reports live-wired only where a shape is actually implemented", () => {
    // The old check was `Boolean(endpoint)`, which called Runway and ElevenLabs
    // live while every submit to either was malformed.
    expect(isLiveWired("runway")).toBe(true);
    expect(isLiveWired("mock")).toBe(true);
    expect(isLiveWired("elevenlabs")).toBe(false);
    expect(isLiveWired("kling")).toBe(false);
    expect(isLiveWired("nope")).toBe(false);
  });

  it("an API key alone cannot enable spend", async () => {
    clearKeys();
    process.env.RUNWAY_API_KEY = "secret-key";
    process.env.RUNWAY_COST_PER_SECOND_USD = "0.05";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitToProvider({
      provider: "runway",
      kind: "gen-video",
      prompt: "locked wide",
      idempotencyKey: "zero-cost",
      options: { durationSec: 5 },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/zero-cost/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits live with auth and an idempotency header, returning the provider id", async () => {
    clearKeys();
    process.env.RUNWAY_API_KEY = "secret-key";
    enableRunwaySpend();
    // Typed with the fetch signature so the recorded init is inspectable.
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        ({ ok: true, json: async () => ({ id: "task_789" }) }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitToProvider({
      provider: "runway",
      kind: "gen-video",
      prompt: "locked wide",
      idempotencyKey: "key-abc",
      options: { durationSec: 10, aspect: "16:9", quality: "social", mode: "text-to-video" },
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.externalId).toBe("task_789");
      expect(res.mode).toBe("live");
    }
    const [url, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-key");
    expect(headers["Idempotency-Key"]).toBe("key-abc");

    // This test used to stop at the two headers above, and that gap is the
    // whole reason a malformed submit shipped: the URL and the body were never
    // asserted, so posting `{prompt}` at a route Runway does not have looked
    // exactly like success in CI.
    expect(String(url)).toBe("https://api.dev.runwayml.com/v1/text_to_video");
    expect(headers["X-Runway-Version"]).toBe("2024-11-06");

    const body = JSON.parse(String(init?.body));
    expect(body.promptText).toBe("locked wide");
    expect(body.model).toBe("gen4.5");
    // Post-2024-11-06 this carries a resolution, not an aspect name.
    expect(body.ratio).toMatch(/^\d+:\d+$/);
    expect(body).not.toHaveProperty("prompt");
    expect(body).not.toHaveProperty("durationSec");
    expect(body).not.toHaveProperty("aspect");
    expect(body).not.toHaveProperty("quality");
    expect(body).not.toHaveProperty("mode");
  });

  it("carries the version header on polls too, not just submits", async () => {
    clearKeys();
    process.env.RUNWAY_API_KEY = "tok";
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        ({ ok: true, json: async () => ({ status: "RUNNING" }) }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    await pollProvider("runway", "task_789");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.dev.runwayml.com/v1/tasks/task_789");
    expect((init?.headers as Record<string, string>)["X-Runway-Version"]).toBe("2024-11-06");
  });

  it("surfaces a provider HTTP error instead of a fabricated success", async () => {
    clearKeys();
    process.env.RUNWAY_API_KEY = "tok";
    enableRunwaySpend();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429 }) as unknown as Response));

    const res = await submitToProvider({ provider: "runway", kind: "gen-video", prompt: "x", idempotencyKey: "k5" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("429");
  });

  it("carries the provider's own explanation into the error, not just the status", async () => {
    // A bare "HTTP 400" cost a source read to diagnose. What the provider says
    // about the refusal is the part that makes it actionable.
    clearKeys();
    process.env.RUNWAY_API_KEY = "tok";
    enableRunwaySpend();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => '{"error":"Invalid value for ratio"}',
      }) as unknown as Response)
    );

    const res = await submitToProvider({ provider: "runway", kind: "gen-video", prompt: "x", idempotencyKey: "k6" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("400");
      expect(res.error).toContain("Invalid value for ratio");
    }
  });

  it("maps each provider's status vocabulary onto the four states", () => {
    expect(normalizeState("SUCCEEDED")).toBe("succeeded");
    expect(normalizeState("complete")).toBe("succeeded");
    expect(normalizeState("in_progress")).toBe("running");
    expect(normalizeState("error")).toBe("failed");
    expect(normalizeState(undefined)).toBe("queued");
    expect(normalizeState("something-new")).toBe("queued");
  });

  it("reads credentials from env, not from a cached snapshot", () => {
    clearKeys();
    expect(hasCredentials("runway")).toBe(false);
    process.env.RUNWAY_API_KEY = "tok";
    expect(hasCredentials("runway")).toBe(true);
    // Providers needing no key are always available.
    expect(hasCredentials("mock")).toBe(true);
    expect(hasCredentials("hyperframes")).toBe(true);
    expect(hasCredentials("nope")).toBe(false);
  });

  it("knows nothing about an unknown provider", () => {
    expect(findProvider("nope")).toBeUndefined();
  });

  it("offers the offline path for every kind a picker can be built for", async () => {
    for (const kind of ["gen-video", "voice", "avatar"] as const) {
      const ids = providerChoicesFor(kind).map((p) => p.id);
      expect(ids).toContain("mock");
      // Listed once, and first — opening a picker must default to zero spend.
      expect(ids.filter((i) => i === "mock")).toHaveLength(1);
      expect(ids[0]).toBe("mock");

      // Anything a picker offers must be something the boundary will accept.
      for (const id of ids) {
        const res = await submitToProvider({ provider: id, kind, prompt: "x", idempotencyKey: `pick-${kind}-${id}` });
        if (!res.ok) expect(res.error).not.toContain("does not serve");
      }
    }
  });
});
