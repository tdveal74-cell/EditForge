import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const SECRET = "sk-super-secret-value-9999";

afterEach(() => {
  for (const key of [
    "RUNWAY_API_KEY",
    "RUNWAYML_API_SECRET",
    "KLING_API_KEY",
    "ELEVENLABS_API_KEY",
    "HEYGEN_API_KEY",
    "HEYGEN_AVATAR_ID",
    "HEYGEN_VOICE_ID",
    "ELEVENLABS_VOICE_ID",
    "ELEVENLABS_VOICE_ID_AUREN",
    "EDITFORGE_ARTIFACT_DIR",
  ]) {
    delete process.env[key];
  }
});

describe("provider readiness endpoint", () => {
  it("reports the credential name and whether it is set, never the value", async () => {
    process.env.RUNWAY_API_KEY = SECRET;

    const res = await GET();
    const body = await res.json();
    const raw = JSON.stringify(body);

    // The whole point of this endpoint is that it is safe to call from a browser.
    expect(raw).not.toContain(SECRET);
    expect(raw).toContain("RUNWAY_API_KEY");

    const runway = body.providers.find((p: { id: string }) => p.id === "runway");
    expect(runway.credentialSet).toBe(true);
    expect(runway.billable).toBe(true);
  });

  it("marks a provider without its credential as not billable", async () => {
    delete process.env.RUNWAY_API_KEY;

    const body = await (await GET()).json();
    const runway = body.providers.find((p: { id: string }) => p.id === "runway");
    expect(runway.credentialSet).toBe(false);
    expect(runway.billable).toBe(false);
    // The live path exists; it is the key that is missing.
    expect(runway.wired).toBe(true);
  });

  it("marks a credentialled provider with no live path as wired-false, not billable", async () => {
    process.env.KLING_API_KEY = "tok";
    const body = await (await GET()).json();
    const kling = body.providers.find((p: { id: string }) => p.id === "kling");
    expect(kling.wired).toBe(false);
    expect(kling.billable).toBe(false);
    delete process.env.KLING_API_KEY;
  });

  it("never marks the offline provider billable", async () => {
    const body = await (await GET()).json();
    const mock = body.providers.find((p: { id: string }) => p.id === "mock");
    expect(mock.billable).toBe(false);
    expect(mock.wired).toBe(false);
  });

  it("will not call a byte-returning provider billable with nowhere to keep the bytes", async () => {
    // ElevenLabs hands back the audio itself. A key alone does not make it
    // runnable, and calling it live here would send the picker to a refusal.
    process.env.ELEVENLABS_API_KEY = "tok";
    process.env.ELEVENLABS_VOICE_ID = "voice-1";
    const withoutStore = await (await GET()).json();
    const before = withoutStore.providers.find((p: { id: string }) => p.id === "elevenlabs");
    expect(withoutStore.artifactStore).toBe(false);
    expect(before.wired).toBe(true);
    expect(before.credentialSet).toBe(true);
    expect(before.settingsMissing).toEqual([]);
    expect(before.requiresArtifactStore).toBe(true);
    // Everything else holds; the store is the only thing standing in the way.
    expect(before.billable).toBe(false);

    process.env.EDITFORGE_ARTIFACT_DIR = "/artifacts";
    const withStore = await (await GET()).json();
    expect(withStore.artifactStore).toBe(true);
    expect(withStore.providers.find((p: { id: string }) => p.id === "elevenlabs").billable).toBe(true);
  });

  it("names the further settings a provider still needs beyond its key", async () => {
    process.env.HEYGEN_API_KEY = "tok";
    const body = await (await GET()).json();
    const heygen = body.providers.find((p: { id: string }) => p.id === "heygen");
    // Reported so a refusal for a missing look id does not read as a bad key.
    expect(heygen.settingsMissing).toEqual(["HEYGEN_AVATAR_ID", "HEYGEN_VOICE_ID"]);

    process.env.HEYGEN_AVATAR_ID = "look-1";
    process.env.HEYGEN_VOICE_ID = "voice-9";
    const ready = await (await GET()).json();
    expect(ready.providers.find((p: { id: string }) => p.id === "heygen").settingsMissing).toEqual([]);
  });

  it("counts a per-voice pin as a configured voice, not a missing default", async () => {
    // Requiring ELEVENLABS_VOICE_ID outright would report a studio that pinned
    // each voice individually as unconfigured — a refusal the boundary would
    // never actually make.
    process.env.ELEVENLABS_API_KEY = "tok";
    const bare = await (await GET()).json();
    expect(
      bare.providers.find((p: { id: string }) => p.id === "elevenlabs").settingsMissing
    ).toEqual(["ELEVENLABS_VOICE_ID"]);

    process.env.ELEVENLABS_VOICE_ID_AUREN = "auren-voice";
    const pinned = await (await GET()).json();
    expect(
      pinned.providers.find((p: { id: string }) => p.id === "elevenlabs").settingsMissing
    ).toEqual([]);
  });

  it("lists every name a credential may be set under", async () => {
    process.env.RUNWAYML_API_SECRET = "sdk-name";
    const body = await (await GET()).json();
    const runway = body.providers.find((p: { id: string }) => p.id === "runway");
    expect(runway.envKeys).toEqual(["RUNWAY_API_KEY", "RUNWAYML_API_SECRET"]);
    expect(runway.credentialSet).toBe(true);
  });
});
