import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { durableCollection } from "./durable";
import { secretsMatch } from "./auth";

const scrypt = promisify(scryptCallback);

type PasswordRecord = {
  id: "current";
  salt: string;
  hash: string;
  updatedAt: string;
};

const passwords = durableCollection<PasswordRecord>({
  key: "editforge:recovery-password",
  file: "recovery-password.json",
  seed: () => [],
});

async function derive(password: string, salt: string): Promise<Buffer> {
  return (await scrypt(password, Buffer.from(salt, "base64url"), 32)) as Buffer;
}

export function validateRecoveryPassword(password: string): string | null {
  if (password.length < 16) return "Use at least 16 characters.";
  if (password.length > 128) return "Use no more than 128 characters.";
  return null;
}

export async function verifyRecoveryPassword(provided: string): Promise<boolean> {
  const stored = await passwords.get("current");
  if (!stored) {
    const initial = process.env.EDITFORGE_ACCESS_PASSWORD || "";
    return Boolean(initial) && secretsMatch(provided, initial);
  }
  const actual = await derive(provided, stored.salt);
  const expected = Buffer.from(stored.hash, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function setRecoveryPassword(password: string): Promise<void> {
  const invalid = validateRecoveryPassword(password);
  if (invalid) throw new Error(invalid);
  const salt = randomBytes(16);
  const hash = await derive(password, salt.toString("base64url"));
  await passwords.mutate((items) => {
    const next: PasswordRecord = {
      id: "current",
      salt: salt.toString("base64url"),
      hash: hash.toString("base64url"),
      updatedAt: new Date().toISOString(),
    };
    const index = items.findIndex((item) => item.id === "current");
    if (index >= 0) items[index] = next;
    else items.push(next);
  });
}

