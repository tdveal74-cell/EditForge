import { promises as fs } from "fs";
import path from "path";

export type CutStatus = "ingest" | "grade" | "review" | "shipped" | "archived";

export type Cut = {
  id: string;
  title: string;
  status: CutStatus;
  presetId?: string;
  rubricPass?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const KV_KEY = "editforge:cuts";
const MAX_CAS_RETRIES = 5;

// Compare-and-set: only write if the value is unchanged since our read
// (ARGV[1] = expected current value, '' when the key was absent).
const CAS_SCRIPT =
  "local cur = redis.call('GET', KEYS[1]) " +
  "if (cur == ARGV[1]) or (cur == false and ARGV[1] == '') then " +
  "redis.call('SET', KEYS[1], ARGV[2]) return 1 end return 0";

// Vercel serverless has a read-only project dir; /tmp is the only writable path (ephemeral per instance).
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "editforge-data")
  : path.join(process.cwd(), ".data");
const CUTS_FILE = path.join(DATA_DIR, "cuts.json");

// Vercel KV / Upstash Redis REST credentials. Marketplace stores attach either
// KV_REST_API_* (Vercel KV naming) or UPSTASH_REDIS_REST_* — accept either,
// but only as a complete url+token pair so schemes never mix.
function kvCreds(): { url: string; token: string } | null {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  }
  return null;
}

export function storeBackend(): "kv" | "file" {
  return kvCreds() ? "kv" : "file";
}

/**
 * Credential variables a Redis/KV provider might attach. Only this fixed list is
 * ever inspected, and only for presence — values are never read out or returned.
 */
const REST_PAIRS = [
  { url: "KV_REST_API_URL", token: "KV_REST_API_TOKEN" },
  { url: "UPSTASH_REDIS_REST_URL", token: "UPSTASH_REDIS_REST_TOKEN" },
] as const;

const KNOWN_STORE_ENV = [
  ...REST_PAIRS.flatMap((p) => [p.url, p.token]),
  "REDIS_URL",
  "KV_URL",
] as const;

/** Names (never values) of known store credentials present in the environment. */
export function storeEnvPresent(): string[] {
  return KNOWN_STORE_ENV.filter((k) => Boolean(process.env[k]));
}

/**
 * Human-readable reason the file backend is in use despite a store being attached.
 * Returns null when Redis is active or nothing store-related is configured at all.
 */
export function storeFallbackReason(): string | null {
  if (kvCreds()) return null;
  const present = new Set(storeEnvPresent());
  if (present.size === 0) return null;

  // Evaluate each scheme's pair on its own. Checking "any URL" against "any
  // token" would call a crossed pair (one variable from each scheme) complete
  // and then blame the wrong thing.
  const partial = REST_PAIRS.filter((p) => present.has(p.url) !== present.has(p.token));
  if (partial.length > 0) {
    const missing = partial.map((p) => (present.has(p.url) ? p.token : p.url));
    return `Incomplete REST credentials — missing ${missing.join(" and ")}`;
  }
  return "A Redis connection string is attached but no HTTP REST credentials; this app speaks the Upstash-compatible REST API";
}

/**
 * Liveness probe for the configured backend.
 * `storeBackend()` only reports which backend is *selected* from env; this
 * actually reaches it, so invalid, expired, or unreachable credentials are
 * reported as unreachable instead of passing as configured.
 */
export async function probeStore(): Promise<{
  backend: "kv" | "file";
  reachable: boolean;
  error?: string;
}> {
  const backend = storeBackend();
  try {
    if (backend === "kv") await kvCommand(["PING"]);
    else await fs.mkdir(DATA_DIR, { recursive: true });
    return { backend, reachable: true };
  } catch (err) {
    return { backend, reachable: false, error: (err as Error).message };
  }
}

async function kvCommand(cmd: string[]): Promise<unknown> {
  const creds = kvCreds();
  if (!creds) throw new Error("KV not configured");
  const res = await fetch(creds.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`KV command ${cmd[0]} failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`KV error: ${data.error}`);
  return data.result ?? null;
}

function seedCuts(): Cut[] {
  const now = new Date().toISOString();
  return [
    { id: "cut-01", title: "TSWS E01 cold open", status: "review", presetId: "tsws-feature", createdAt: now, updatedAt: now },
    { id: "cut-02", title: "Faceless — Authentic Human Teaching", status: "grade", presetId: "faceless-teach", createdAt: now, updatedAt: now },
    { id: "cut-03", title: "Shorts pack — week 32", status: "ingest", presetId: "tsws-short", createdAt: now, updatedAt: now },
  ];
}

async function writeFileStore(cuts: Cut[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${CUTS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(cuts, null, 2));
  await fs.rename(tmp, CUTS_FILE);
}

async function readFileStore(): Promise<Cut[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  let raw: string;
  try {
    raw = await fs.readFile(CUTS_FILE, "utf8");
  } catch (err) {
    // Seed only when the file genuinely doesn't exist; a malformed or
    // unreadable store must surface, never be silently overwritten.
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    const seed = seedCuts();
    await writeFileStore(seed);
    return seed;
  }
  return JSON.parse(raw) as Cut[];
}

async function readAll(): Promise<Cut[]> {
  if (kvCreds()) {
    const raw = (await kvCommand(["GET", KV_KEY])) as string | null;
    if (raw != null) return JSON.parse(raw) as Cut[];
    // Atomic first-writer-wins seed, then re-read the canonical value.
    await kvCommand(["SET", KV_KEY, JSON.stringify(seedCuts()), "NX"]);
    const seeded = (await kvCommand(["GET", KV_KEY])) as string;
    return JSON.parse(seeded) as Cut[];
  }
  return readFileStore();
}

/**
 * Atomically apply a mutation to the cuts list.
 * KV backend: optimistic concurrency — read, mutate, compare-and-set, retry
 * on conflict so overlapping serverless requests never lose each other's writes.
 */
async function mutate(fn: (cuts: Cut[]) => void): Promise<Cut[]> {
  if (kvCreds()) {
    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
      const raw = (await kvCommand(["GET", KV_KEY])) as string | null;
      const cuts = raw == null ? seedCuts() : (JSON.parse(raw) as Cut[]);
      fn(cuts);
      const next = JSON.stringify(cuts);
      const ok = await kvCommand(["EVAL", CAS_SCRIPT, "1", KV_KEY, raw ?? "", next]);
      if (ok === 1) return cuts;
    }
    throw new Error("KV update failed: concurrent-write retries exhausted");
  }
  const cuts = await readFileStore();
  fn(cuts);
  await writeFileStore(cuts);
  return cuts;
}

export async function listCuts(): Promise<Cut[]> {
  return readAll();
}

export async function getCut(id: string): Promise<Cut | null> {
  const cuts = await readAll();
  return cuts.find((c) => c.id === id) ?? null;
}

export async function upsertCut(cut: Cut): Promise<Cut> {
  await mutate((cuts) => {
    const i = cuts.findIndex((c) => c.id === cut.id);
    if (i >= 0) cuts[i] = cut;
    else cuts.unshift(cut);
  });
  return cut;
}

export async function setRubricPass(id: string, pass: boolean): Promise<Cut | null> {
  let updated: Cut | null = null;
  await mutate((cuts) => {
    const cut = cuts.find((c) => c.id === id);
    if (!cut) return;
    cut.rubricPass = pass;
    cut.status = pass ? "review" : "grade";
    cut.updatedAt = new Date().toISOString();
    updated = cut;
  });
  return updated;
}
