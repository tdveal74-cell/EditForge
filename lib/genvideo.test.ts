import { describe, expect, it } from "vitest";
import { pickProvider, submitGenVideo } from "./genvideo";

describe("genvideo boundary", () => {
  it("defaults unknown provider to mock", () => {
    expect(pickProvider("nope")).toBe("mock");
  });

  it("mock submit always succeeds offline", () => {
    const r = submitGenVideo({
      provider: "mock",
      mode: "text-to-video",
      prompt: "calm desk shot",
      tier: "draft",
      idempotencyKey: "t1",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mode).toBe("mock");
      expect(r.status).toBe("queued");
    }
  });

  it("live provider without key fails closed", () => {
    const r = submitGenVideo({
      provider: "runway",
      mode: "text-to-video",
      prompt: "x",
      tier: "draft",
      idempotencyKey: "t2",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/RUNWAY_API_KEY/);
  });
});
