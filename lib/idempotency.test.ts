import { describe, expect, it } from "vitest";
import { idempotencyKeyFor } from "./idempotency";

describe("idempotency keys", () => {
  it("gives the same key for the same brief, so a double submit is one job", () => {
    const a = idempotencyKeyFor("gen-video", { prompt: "locked wide", aspect: "16:9" });
    const b = idempotencyKeyFor("gen-video", { prompt: "locked wide", aspect: "16:9" });
    expect(a).toBe(b);
  });

  it("ignores key order — the same brief written differently is the same work", () => {
    const a = idempotencyKeyFor("gen-video", { prompt: "x", aspect: "16:9" });
    const b = idempotencyKeyFor("gen-video", { aspect: "16:9", prompt: "x" });
    expect(a).toBe(b);
  });

  it("changes when any part of the brief changes", () => {
    const base = idempotencyKeyFor("gen-video", { prompt: "x", aspect: "16:9" });
    expect(idempotencyKeyFor("gen-video", { prompt: "y", aspect: "16:9" })).not.toBe(base);
    expect(idempotencyKeyFor("gen-video", { prompt: "x", aspect: "9:16" })).not.toBe(base);
  });

  it("separates kinds, so a voice and a video brief cannot collide", () => {
    const brief = { prompt: "same words" };
    expect(idempotencyKeyFor("voice", brief)).not.toBe(idempotencyKeyFor("gen-video", brief));
  });

  it("treats an absent field and an undefined field as the same brief", () => {
    expect(idempotencyKeyFor("voice", { text: "hi" })).toBe(
      idempotencyKeyFor("voice", { text: "hi", seed: undefined })
    );
  });

  it("distinguishes nested differences rather than flattening them away", () => {
    const a = idempotencyKeyFor("voice", { opts: { stability: 0.3 } });
    const b = idempotencyKeyFor("voice", { opts: { stability: 0.7 } });
    expect(a).not.toBe(b);
  });

  it("produces a compact, url-safe key", () => {
    expect(idempotencyKeyFor("voice", { text: "hi" })).toMatch(/^voice-[0-9a-f]{8}$/);
  });
});
