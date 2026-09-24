import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pollProvider, submitToProvider } from "./providers";

const saved = { ...process.env };
let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "ef-runway-"));
  for (const k of Object.keys(process.env))
    if (/^(XAI|RUNWAY|EDITFORGE_RUNWAY)/.test(k)) delete process.env[k];
  process.env.RUNWAY_API_KEY = "tok";
});
afterEach(async () => {
  vi.unstubAllGlobals();
  process.env = { ...saved };
  await rm(dir, { recursive: true, force: true });
});

function okFetch(id = "task-1") {
  const f = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      ({ ok: true, json: async () => ({ id }) }) as unknown as Response,
  );
  vi.stubGlobal("fetch", f);
  return f;
}
const bodyOf = (f: ReturnType<typeof okFetch>) =>
  JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));

describe("runway-image, Canvas stills on Runway", () => {
  it("submits text_to_image with gen4_image and the Runway resolution for the aspect", async () => {
    const f = okFetch();
    const r = await submitToProvider({
      provider: "runway-image",
      kind: "gen-image",
      prompt: "a lighthouse at dusk",
      idempotencyKey: "still-1",
      options: { aspect: "9:16" },
    });
    expect(r.ok).toBe(true);
    expect(String(f.mock.calls[0][0])).toBe("https://api.dev.runwayml.com/v1/text_to_image");
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Runway-Version"]).toBe("2024-11-06");
    expect(bodyOf(f)).toEqual({ model: "gen4_image", promptText: "a lighthouse at dusk", ratio: "1080:1920" });
  });

  it("refuses 3:2 and an over-long prompt before any network call", async () => {
    const f = okFetch();
    const a = await submitToProvider({
      provider: "runway-image", kind: "gen-image", prompt: "x", idempotencyKey: "s2", options: { aspect: "3:2" },
    });
    const b = await submitToProvider({
      provider: "runway-image", kind: "gen-image", prompt: "x".repeat(1001), idempotencyKey: "s3", options: { aspect: "1:1" },
    });
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("reads the finished still off the task output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ status: "SUCCEEDED", output: ["https://dnznrvs05pmza.cloudfront.net/still.png"] }),
      }) as unknown as Response),
    );
    const r = await pollProvider("runway-image", "task-1");
    expect(r).toMatchObject({ state: "succeeded", result: "https://dnznrvs05pmza.cloudfront.net/still.png" });
  });
});

describe("runway reference-to-video, Canvas motion from a Canvas still", () => {
  const still = "data:image/png;base64,iVBORw0KGgo=";

  it("animates the caller's still and never reads the presenter file", async () => {
    const presenter = path.join(dir, "tee.png");
    await writeFile(presenter, new Uint8Array([1, 2, 3, 4]));
    process.env.EDITFORGE_RUNWAY_CHARACTER_FILE = presenter;
    const f = okFetch();
    const r = await submitToProvider({
      provider: "runway",
      kind: "gen-video",
      prompt: "slow push in",
      idempotencyKey: "ref-1",
      options: { mode: "reference-to-video", aspect: "16:9", duration: 6, imageUrl: still },
    });
    expect(r.ok).toBe(true);
    expect(String(f.mock.calls[0][0])).toBe("https://api.dev.runwayml.com/v1/image_to_video");
    const body = bodyOf(f);
    expect(body.promptImage).toBe(still);
    expect(body.promptImage).not.toBe("data:image/png;base64,AQIDBA==");
    expect(body).toMatchObject({ model: "gen4.5", ratio: "1280:720", duration: 6 });
    expect(body).not.toHaveProperty("imageUrl");
  });

  it("accepts an HTTPS still, which is how a Runway still comes back", async () => {
    const f = okFetch();
    const r = await submitToProvider({
      provider: "runway", kind: "gen-video", prompt: "drift", idempotencyKey: "ref-2",
      options: { mode: "reference-to-video", aspect: "9:16", duration: 5, imageUrl: "https://example.com/a.png" },
    });
    expect(r.ok).toBe(true);
    expect(bodyOf(f).promptImage).toBe("https://example.com/a.png");
  });

  it("refuses a missing, non-HTTPS or oversized reference before any network call", async () => {
    const f = okFetch();
    const big = "data:image/jpeg;base64," + "A".repeat(4_500_000);
    for (const [key, imageUrl] of [["m", ""], ["h", "http://example.com/a.png"], ["f", "file:///etc/passwd"], ["b", big]]) {
      const r = await submitToProvider({
        provider: "runway", kind: "gen-video", prompt: "x", idempotencyKey: `bad-${key}`,
        options: { mode: "reference-to-video", aspect: "16:9", duration: 5, imageUrl },
      });
      expect(r.ok, key).toBe(false);
    }
    expect(f).not.toHaveBeenCalled();
  });
});
