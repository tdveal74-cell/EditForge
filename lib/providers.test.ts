import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findProvider,
  hasCredentials,
  normalizeState,
  pollProvider,
  providerChoicesFor,
  providersFor,
  submitToProvider,
} from "./providers";

const KEYS = ["RUNWAY_API_KEY", "KLING_API_KEY", "VEO_API_KEY", "SEEDREAM_API_KEY", "ELEVENLABS_API_KEY"];

function clearKeys() {
  for (const k of KEYS) delete process.env[k];
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

  it("refuses a credentialled provider that has no wired endpoint yet", async () => {
    clearKeys();
    process.env.KLING_API_KEY = "tok";
    const res = await submitToProvider({ provider: "kling", kind: "gen-video", prompt: "x", idempotencyKey: "k3" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no wired endpoint/i);
  });

  it("submits live with auth and an idempotency header, returning the provider id", async () => {
    clearKeys();
    process.env.RUNWAY_API_KEY = "secret-key";
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
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.externalId).toBe("task_789");
      expect(res.mode).toBe("live");
    }
    const init = fetchMock.mock.calls[0][1];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-key");
    expect(headers["Idempotency-Key"]).toBe("key-abc");
  });

  it("surfaces a provider HTTP error instead of a fabricated success", async () => {
    clearKeys();
    process.env.RUNWAY_API_KEY = "tok";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429 }) as unknown as Response));

    const res = await submitToProvider({ provider: "runway", kind: "gen-video", prompt: "x", idempotencyKey: "k4" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("429");
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
      // Listed once, and last — the real providers lead.
      expect(ids.filter((i) => i === "mock")).toHaveLength(1);
      expect(ids[ids.length - 1]).toBe("mock");

      // Anything a picker offers must be something the boundary will accept.
      for (const id of ids) {
        const res = await submitToProvider({ provider: id, kind, prompt: "x", idempotencyKey: `pick-${kind}-${id}` });
        if (!res.ok) expect(res.error).not.toContain("does not serve");
      }
    }
  });
});
