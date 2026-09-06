import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  setRecoveryPassword,
  validateRecoveryPassword,
  verifyRecoveryPassword,
} from "./access-password";

let testDir = "";

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "editforge-password-"));
  process.env.EDITFORGE_DATA_DIR = testDir;
  process.env.EDITFORGE_ACCESS_PASSWORD = "initial-recovery-password";
});

afterEach(async () => {
  delete process.env.EDITFORGE_DATA_DIR;
  delete process.env.EDITFORGE_ACCESS_PASSWORD;
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("recovery password", () => {
  it("uses the initial environment secret before a rotation", async () => {
    expect(await verifyRecoveryPassword("initial-recovery-password")).toBe(true);
    expect(await verifyRecoveryPassword("wrong-recovery-password")).toBe(false);
  });

  it("replaces the initial secret with a durable salted verifier", async () => {
    const replacement = "replacement-password-2026";
    await setRecoveryPassword(replacement);
    expect(await verifyRecoveryPassword(replacement)).toBe(true);
    expect(await verifyRecoveryPassword("initial-recovery-password")).toBe(false);

    const stored = await fs.readFile(path.join(testDir, "recovery-password.json"), "utf8");
    expect(stored).not.toContain(replacement);
    expect(stored).toContain('"salt"');
    expect(stored).toContain('"hash"');
  });

  it("enforces the recovery password bounds", () => {
    expect(validateRecoveryPassword("short")).toBe("Use at least 16 characters.");
    expect(validateRecoveryPassword("a".repeat(16))).toBeNull();
    expect(validateRecoveryPassword("a".repeat(129))).toBe("Use no more than 128 characters.");
  });
});
