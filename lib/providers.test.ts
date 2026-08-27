import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  credentialKeysFor,
  elevenLabsVoiceId,
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
  "RUNWAYML_API_SECRET",
  "KLING_API_KEY",
  "VEO_API_KEY",
  "SEEDREAM_API_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_VOICE_ID_AUREN",
  "HEYGEN_API_KEY",
  "HEYGEN_AVATAR_ID",
  "HEYGEN_VOICE_ID",
  "EDITFORGE_ARTIFACT_DIR",
  "EDITFORGE_ARTIFACT_BASE_URL",
  "EDITFORGE_PUBLIC_URL",
];

function clearKeys() {
  for (const k of KEYS) delete process.env[k];
}

let store: string;

beforeEach(async () => {
  store = await mkdtemp(path.join(tmpdir(), "editforge-artifacts-"));
});

afterEach(async () => {
  clearKeys();
  vi.unstubAllGlobals();
  await rm(store, { recursive: true, force: true });
});

/** A response carrying bytes, the way ElevenLabs answers a TTS submit. */
function audioResponse(bytes: Uint8Array) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "audio/mpeg" }),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as Response;
}

describe("provider boundary", () => {
  it("routes providers by the kind of work they serve", () => {
    expect(providersFor("voice").map((p) => p.id)).toContain("elevenlabs");
    expect(providersFor("avatar").map((p) => p.id)).toContain("heygen");
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

  it("reports live-wired only where a shape is actually implemented", () => {
    // The old check was `Boolean(endpoint)`, which called Runway and ElevenLabs
    // live while every submit to either was malformed.
    expect(isLiveWired("runway")).toBe(true);
    expect(isLiveWired("elevenlabs")).toBe(true);
    expect(isLiveWired("heygen")).toBe(true);
    expect(isLiveWired("mock")).toBe(true);
    expect(isLiveWired("kling")).toBe(false);
    expect(isLiveWired("nope")).toBe(false);
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
    expect(body.duration).toBe(5);
    expect(body).not.toHaveProperty("prompt");
  });

  it("accepts Runway's own credential name as well as ours", async () => {
    // compose.yaml already sets RUNWAYML_API_SECRET for the private adapter.
    // Making the control plane demand a second name for the same key is a
    // configuration trap, not a safety property.
    clearKeys();
    process.env.RUNWAYML_API_SECRET = "sdk-name";
    expect(hasCredentials("runway")).toBe(true);
    expect(credentialKeysFor(findProvider("runway")!)).toEqual(["RUNWAY_API_KEY", "RUNWAYML_API_SECRET"]);

    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        ({ ok: true, json: async () => ({ id: "t1" }) }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await submitToProvider({ provider: "runway", kind: "gen-video", prompt: "x", idempotencyKey: "alias" });
    expect(res.ok).toBe(true);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sdk-name");
  });

  it("refuses a Runway request the provider would reject, before spending a call", async () => {
    clearKeys();
    process.env.RUNWAY_API_KEY = "tok";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ratio = await submitToProvider({
      provider: "runway",
      kind: "gen-video",
      prompt: "x",
      idempotencyKey: "bad-ratio",
      options: { ratio: "16:9" },
    });
    expect(ratio.ok).toBe(false);
    if (!ratio.ok) expect(ratio.error).toMatch(/ratio must be/i);

    const duration = await submitToProvider({
      provider: "runway",
      kind: "gen-video",
      prompt: "x",
      idempotencyKey: "bad-duration",
      options: { duration: 30 },
    });
    expect(duration.ok).toBe(false);
    if (!duration.ok) expect(duration.error).toMatch(/2 to 10/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("translates the studio's aspect and seconds into Runway's own parameters", async () => {
    // The gen-video page speaks in aspects and seconds. Spreading that brief
    // straight into the body sent Runway `aspect`, `quality` and `durationSec`,
    // fields it does not define and rejects — so the studio's controls could
    // only ever produce a 400.
    clearKeys();
    process.env.RUNWAY_API_KEY = "tok";
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        ({ ok: true, json: async () => ({ id: "t1" }) }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    await submitToProvider({
      provider: "runway",
      kind: "gen-video",
      prompt: "x",
      idempotencyKey: "portrait",
      options: { aspect: "9:16", durationSec: 8, quality: "social", mode: "text-to-video" },
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.ratio).toBe("720:1280");
    expect(body.duration).toBe(8);
    expect(body).not.toHaveProperty("aspect");
    expect(body).not.toHaveProperty("quality");
    expect(body).not.toHaveProperty("durationSec");
    expect(body).not.toHaveProperty("mode");
  });

  it("refuses an aspect Runway text-to-video does not render", async () => {
    clearKeys();
    process.env.RUNWAY_API_KEY = "tok";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await submitToProvider({
      provider: "runway",
      kind: "gen-video",
      prompt: "x",
      idempotencyKey: "square",
      options: { aspect: "1:1" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/16:9 or 9:16/);
    expect(fetchMock).not.toHaveBeenCalled();
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

describe("ElevenLabs voice", () => {
  it("resolves a studio voice to a provider voice, per-voice first", () => {
    clearKeys();
    expect(elevenLabsVoiceId(process.env, "vo-auren")).toBe("");
    process.env.ELEVENLABS_VOICE_ID = "default-voice";
    expect(elevenLabsVoiceId(process.env, "vo-auren")).toBe("default-voice");
    process.env.ELEVENLABS_VOICE_ID_AUREN = "auren-voice";
    expect(elevenLabsVoiceId(process.env, "vo-auren")).toBe("auren-voice");
    // A caller that already knows the provider's own id passes it straight on.
    expect(elevenLabsVoiceId(process.env, "JBFqnCBsd6RMkjVDRZzb")).toBe("JBFqnCBsd6RMkjVDRZzb");
  });

  it("refuses before the request when no provider voice is configured", async () => {
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "tok";
    process.env.EDITFORGE_ARTIFACT_DIR = store;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitToProvider({
      provider: "elevenlabs",
      kind: "voice",
      prompt: "read this",
      idempotencyKey: "v1",
      options: { voiceId: "vo-auren" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/ELEVENLABS_VOICE_ID/);
    // The point of refusing here is that nothing was spent.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses when there is nowhere to keep the audio it would pay for", async () => {
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "tok";
    process.env.ELEVENLABS_VOICE_ID = "voice-1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitToProvider({
      provider: "elevenlabs",
      kind: "voice",
      prompt: "read this",
      idempotencyKey: "v2",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/EDITFORGE_ARTIFACT_DIR/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("synthesises with the voice in the path and the key in xi-api-key", async () => {
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "el-key";
    process.env.ELEVENLABS_VOICE_ID = "voice-1";
    process.env.EDITFORGE_ARTIFACT_DIR = store;
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => audioResponse(bytes));
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitToProvider({
      provider: "elevenlabs",
      kind: "voice",
      prompt: "Where are we today?",
      idempotencyKey: "v3",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice-1?output_format=mp3_44100_128"
    );
    const headers = init?.headers as Record<string, string>;
    // A bearer token here is a 401 that looks exactly like a bad key.
    expect(headers["xi-api-key"]).toBe("el-key");
    expect(headers.Authorization).toBeUndefined();
    const body = JSON.parse(String(init?.body));
    expect(body.text).toBe("Where are we today?");
    expect(body.model_id).toBe("eleven_multilingual_v2");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // The bytes are the render. They must be on disk before this reports success.
    const stored = await readFile(path.join(store, res.externalId));
    expect(new Uint8Array(stored)).toEqual(bytes);
    expect(res.externalId).toMatch(/^elevenlabs-voice-[0-9a-f]{16}\.mp3$/);
    expect(res.externalId).toContain(createHash("sha256").update(bytes).digest("hex").slice(0, 16));
  });

  it("says the store failed, not that the provider was unreachable", async () => {
    // The provider answered and was paid. Reporting a store failure as
    // "ElevenLabs unreachable" sends whoever reads the job to check the one
    // thing that worked.
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "el-key";
    process.env.ELEVENLABS_VOICE_ID = "voice-1";
    process.env.EDITFORGE_ARTIFACT_DIR = store;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => audioResponse(new Uint8Array()))
    );

    const res = await submitToProvider({
      provider: "elevenlabs",
      kind: "voice",
      prompt: "read this",
      idempotencyKey: "v-empty",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/could not be stored/);
      expect(res.error).not.toMatch(/unreachable/);
    }
  });

  it("settles at the store rather than polling a task that does not exist", async () => {
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "el-key";
    process.env.EDITFORGE_ARTIFACT_DIR = store;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await pollProvider("elevenlabs", "elevenlabs-voice-abcdef0123456789.mp3");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state).toBe("succeeded");
      expect(res.result).toBe("/api/artifacts/elevenlabs-voice-abcdef0123456789.mp3");
    }
    // ElevenLabs has no task route; issuing one would 404.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("HeyGen avatar", () => {
  it("refuses before the request when the look or the voice is unset", async () => {
    clearKeys();
    process.env.HEYGEN_API_KEY = "hg";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const noAvatar = await submitToProvider({ provider: "heygen", kind: "avatar", prompt: "hi", idempotencyKey: "a1" });
    expect(noAvatar.ok).toBe(false);
    if (!noAvatar.ok) expect(noAvatar.error).toContain("HEYGEN_AVATAR_ID");

    process.env.HEYGEN_AVATAR_ID = "look-1";
    const noVoice = await submitToProvider({ provider: "heygen", kind: "avatar", prompt: "hi", idempotencyKey: "a2" });
    expect(noVoice.ok).toBe(false);
    if (!noVoice.ok) expect(noVoice.error).toContain("HEYGEN_VOICE_ID");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits the script with the key in X-Api-Key and reads the id out of `data`", async () => {
    clearKeys();
    process.env.HEYGEN_API_KEY = "hg-key";
    process.env.HEYGEN_AVATAR_ID = "look-1";
    process.env.HEYGEN_VOICE_ID = "voice-9";
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        ({ ok: true, json: async () => ({ data: { id: "vid_xyz789", status: "pending" } }) }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitToProvider({
      provider: "heygen",
      kind: "avatar",
      prompt: "Three steps. No hype.",
      idempotencyKey: "a3",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.heygen.com/v3/videos");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe("hg-key");
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.parse(String(init?.body))).toMatchObject({
      type: "avatar",
      avatar_id: "look-1",
      voice_id: "voice-9",
      script: "Three steps. No hype.",
    });

    expect(res.ok).toBe(true);
    // Reading `id` off the envelope root finds nothing; HeyGen nests in `data`.
    if (res.ok) expect(res.externalId).toBe("vid_xyz789");
  });

  it("reads status and the finished URL out of the envelope, not the root", async () => {
    clearKeys();
    process.env.HEYGEN_API_KEY = "hg-key";
    const respond = (body: unknown) =>
      vi.fn(async () => ({ ok: true, json: async () => body }) as unknown as Response);

    vi.stubGlobal("fetch", respond({ data: { status: "processing" } }));
    const running = await pollProvider("heygen", "vid_1");
    expect(running.ok && running.state).toBe("running");

    vi.stubGlobal(
      "fetch",
      respond({ data: { status: "completed", video_url: "https://files.heygen.ai/video/vid_1.mp4" } })
    );
    const done = await pollProvider("heygen", "vid_1");
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.state).toBe("succeeded");
      expect(done.result).toBe("https://files.heygen.ai/video/vid_1.mp4");
    }

    vi.stubGlobal("fetch", respond({ data: { status: "failed", failure_message: "script too long" } }));
    const failed = await pollProvider("heygen", "vid_1");
    expect(failed.ok).toBe(true);
    if (failed.ok) {
      expect(failed.state).toBe("failed");
      expect(failed.note).toBe("script too long");
    }
  });

  it("polls the video route the submit's id belongs to", async () => {
    clearKeys();
    process.env.HEYGEN_API_KEY = "hg-key";
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        ({ ok: true, json: async () => ({ data: { status: "pending" } }) }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);
    await pollProvider("heygen", "vid_xyz789");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.heygen.com/v3/videos/vid_xyz789");
  });
});
