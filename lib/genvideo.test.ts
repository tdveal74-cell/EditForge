import { afterEach, describe, expect, it } from "vitest";
import { GEN_PROVIDERS, pickProvider, providerReady } from "./genvideo";

afterEach(() => {
  delete process.env.RUNWAY_API_KEY;
  delete process.env.RUNWAYML_API_SECRET;
  delete process.env.KLING_API_KEY;
});

describe("genvideo catalogue", () => {
  it("defaults unknown provider to mock", () => {
    expect(pickProvider("nope")).toBe("mock");
  });

  it("is built from the same registry the boundary dispatches on", () => {
    // Two hand-maintained provider lists is two chances to disagree, and the
    // one that disagreed was the one the UI drew from.
    expect(GEN_PROVIDERS.map((p) => p.id)).toEqual([
      "xai-video",
      "runway",
      "kling",
      "veo",
      "seedream",
      "mock",
    ]);
    expect(GEN_PROVIDERS.find((p) => p.id === "runway")?.envKeys).toEqual([
      "RUNWAY_API_KEY",
      "RUNWAYML_API_SECRET",
    ]);
    expect(GEN_PROVIDERS.find((p) => p.id === "runway")?.liveWired).toBe(true);
    expect(GEN_PROVIDERS.find((p) => p.id === "kling")?.liveWired).toBe(false);
  });

  it("calls a provider ready only when its shape and its key both exist", () => {
    expect(providerReady("mock")).toBe(true);
    expect(providerReady("runway")).toBe(false);
    process.env.RUNWAY_API_KEY = "tok";
    expect(providerReady("runway")).toBe(true);
    // Kling has a key here and still no implemented shape.
    process.env.KLING_API_KEY = "tok";
    expect(providerReady("kling")).toBe(false);
  });
});
