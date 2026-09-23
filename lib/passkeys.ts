import { durableCollection } from "./durable";

export type PasskeyKind = "registration" | "authentication";

export type StoredPasskey = {
  id: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
};

type StoredChallenge = {
  id: string;
  challenge: string;
  kind: PasskeyKind;
  expiresAt: number;
};

const passkeys = durableCollection<StoredPasskey>({
  key: "editforge:passkeys",
  file: "passkeys.json",
  seed: () => [],
});

const challenges = durableCollection<StoredChallenge>({
  key: "editforge:passkey-challenges",
  file: "passkey-challenges.json",
  seed: () => [],
});

export function passkeyConfig() {
  const production = process.env.NODE_ENV === "production";
  return {
    rpID: process.env.EDITFORGE_PASSKEY_RP_ID?.trim() || (production ? "editforge.online" : "localhost"),
    origin:
      process.env.EDITFORGE_PASSKEY_ORIGIN?.trim() ||
      (production ? "https://editforge.online" : "http://localhost:3000"),
    rpName: process.env.EDITFORGE_PASSKEY_NAME?.trim() || "EditForge",
  };
}

export async function listPasskeys(): Promise<StoredPasskey[]> {
  return passkeys.list();
}

export async function getPasskey(id: string): Promise<StoredPasskey | null> {
  return passkeys.get(id);
}

export async function savePasskey(passkey: StoredPasskey): Promise<void> {
  await passkeys.mutate((items) => {
    const index = items.findIndex((item) => item.id === passkey.id);
    if (index >= 0) items[index] = passkey;
    else items.push(passkey);
  });
}

export async function updatePasskeyCounter(id: string, counter: number): Promise<void> {
  await passkeys.mutate((items) => {
    const passkey = items.find((item) => item.id === id);
    if (!passkey) throw new Error("Passkey no longer exists");
    passkey.counter = counter;
    passkey.lastUsedAt = new Date().toISOString();
  });
}

export async function removePasskey(id: string): Promise<boolean> {
  let removed = false;
  await passkeys.mutate((items) => {
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0) {
      items.splice(index, 1);
      removed = true;
    }
  });
  return removed;
}

export async function issueChallenge(kind: PasskeyKind, challenge: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await challenges.mutate((items) => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].expiresAt <= now) items.splice(i, 1);
    }
    items.push({ id, challenge, kind, expiresAt: now + 5 * 60 * 1000 });
    if (items.length > 100) items.splice(0, items.length - 100);
  });
  return id;
}

export async function consumeChallenge(id: string, kind: PasskeyKind): Promise<string | null> {
  let challenge: string | null = null;
  const now = Date.now();
  await challenges.mutate((items) => {
    const index = items.findIndex((item) => item.id === id && item.kind === kind);
    if (index < 0) return;
    const [item] = items.splice(index, 1);
    if (item.expiresAt > now) challenge = item.challenge;
  });
  return challenge;
}

