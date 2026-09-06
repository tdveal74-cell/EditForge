import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  consumeChallenge,
  getPasskey,
  issueChallenge,
  listPasskeys,
  passkeyConfig,
  removePasskey,
  savePasskey,
  updatePasskeyCounter,
} from "./passkeys";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "editforge-passkeys-"));
  process.env.EDITFORGE_DATA_DIR = dir;
});

afterEach(async () => {
  delete process.env.EDITFORGE_DATA_DIR;
  delete process.env.EDITFORGE_PASSKEY_RP_ID;
  delete process.env.EDITFORGE_PASSKEY_ORIGIN;
  delete process.env.EDITFORGE_PASSKEY_NAME;
  await rm(dir, { recursive: true, force: true });
});

describe("passkey challenges", () => {
  it("consumes a challenge exactly once and refuses the wrong ceremony", async () => {
    const id = await issueChallenge("authentication", "challenge-a");
    expect(await consumeChallenge(id, "registration")).toBeNull();
    expect(await consumeChallenge(id, "authentication")).toBe("challenge-a");
    expect(await consumeChallenge(id, "authentication")).toBeNull();
  });
});

describe("passkey records", () => {
  it("persists only the public credential and advances its replay counter", async () => {
    await savePasskey({
      id: "credential-a",
      publicKey: "public-key-only",
      counter: 0,
      transports: ["internal"],
      deviceType: "multiDevice",
      backedUp: true,
      label: "Phone",
      createdAt: "2026-09-06T00:00:00.000Z",
    });
    await updatePasskeyCounter("credential-a", 7);
    expect((await getPasskey("credential-a"))?.counter).toBe(7);
    expect(await listPasskeys()).toHaveLength(1);
    expect(await removePasskey("credential-a")).toBe(true);
    expect(await removePasskey("credential-a")).toBe(false);
  });
});

describe("relying party configuration", () => {
  it("supports an explicit verified origin", () => {
    process.env.EDITFORGE_PASSKEY_RP_ID = "studio.example.com";
    process.env.EDITFORGE_PASSKEY_ORIGIN = "https://studio.example.com";
    process.env.EDITFORGE_PASSKEY_NAME = "Studio";
    expect(passkeyConfig()).toEqual({
      rpID: "studio.example.com",
      origin: "https://studio.example.com",
      rpName: "Studio",
    });
  });
});
