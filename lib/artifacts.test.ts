import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  artifactDir,
  artifactStoreConfigured,
  artifactUrl,
  contentTypeForArtifact,
  isArtifactName,
  storeArtifact,
} from "./artifacts";

let store: string;

beforeEach(async () => {
  store = await mkdtemp(path.join(tmpdir(), "editforge-store-"));
});

afterEach(async () => {
  delete process.env.EDITFORGE_ARTIFACT_DIR;
  delete process.env.EDITFORGE_ARTIFACT_BASE_URL;
  delete process.env.EDITFORGE_PUBLIC_URL;
  await rm(store, { recursive: true, force: true });
});

describe("artifact store", () => {
  it("is absent until a directory is configured", () => {
    expect(artifactDir()).toBeNull();
    expect(artifactStoreConfigured()).toBe(false);
    process.env.EDITFORGE_ARTIFACT_DIR = store;
    expect(artifactStoreConfigured()).toBe(true);
  });

  it("accepts the audio and video the studio actually produces", () => {
    expect(isArtifactName("cut-master.mp4")).toBe(true);
    expect(isArtifactName("vo-take.mp3")).toBe(true);
    expect(isArtifactName("vo-take.wav")).toBe(true);
    // A store that could hold an .mp3 but a route that could only serve video
    // was the bug; both now read the same rule.
    expect(contentTypeForArtifact("vo-take.mp3")).toBe("audio/mpeg");
    expect(contentTypeForArtifact("cut-master.mov")).toBe("video/quicktime");
  });

  it("refuses a name that would escape the store", () => {
    expect(isArtifactName("../etc/passwd")).toBe(false);
    expect(isArtifactName("nested/take.mp3")).toBe(false);
    expect(isArtifactName("take.exe")).toBe(false);
    expect(isArtifactName("take")).toBe(false);
  });

  it("names files by their content, so a retry lands on the same file", async () => {
    process.env.EDITFORGE_ARTIFACT_DIR = store;
    const bytes = new Uint8Array([9, 8, 7, 6]);
    const first = await storeArtifact({ bytes, extension: ".mp3", prefix: "elevenlabs-voice" });
    const again = await storeArtifact({ bytes, extension: ".mp3", prefix: "elevenlabs-voice" });

    expect(first.name).toBe(again.name);
    expect(first.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(first.byteLength).toBe(4);
    expect(first.contentType).toBe("audio/mpeg");
    expect(new Uint8Array(await readFile(path.join(store, first.name)))).toEqual(bytes);
  });

  it("sanitises a prefix rather than writing a name it could not serve back", async () => {
    process.env.EDITFORGE_ARTIFACT_DIR = store;
    const stored = await storeArtifact({
      bytes: new Uint8Array([1]),
      extension: "mp3",
      prefix: "../weird prefix/../",
    });
    expect(isArtifactName(stored.name)).toBe(true);
    expect(stored.name).not.toContain("/");
  });

  it("refuses to record empty bytes as a render", async () => {
    process.env.EDITFORGE_ARTIFACT_DIR = store;
    await expect(
      storeArtifact({ bytes: new Uint8Array(), extension: ".mp3", prefix: "voice" })
    ).rejects.toThrow(/empty/);
  });

  it("refuses when there is no store, rather than dropping paid-for bytes quietly", async () => {
    await expect(
      storeArtifact({ bytes: new Uint8Array([1]), extension: ".mp3", prefix: "voice" })
    ).rejects.toThrow(/EDITFORGE_ARTIFACT_DIR/);
  });

  it("serves from the app by default and from an absolute base when one is set", () => {
    expect(artifactUrl("take.mp3")).toBe("/api/artifacts/take.mp3");
    process.env.EDITFORGE_PUBLIC_URL = "https://studio.example.com/";
    expect(artifactUrl("take.mp3")).toBe("https://studio.example.com/api/artifacts/take.mp3");
    process.env.EDITFORGE_ARTIFACT_BASE_URL = "https://cdn.example.com/artifacts/";
    expect(artifactUrl("take.mp3")).toBe("https://cdn.example.com/artifacts/take.mp3");
  });
});
