import { promises as fs } from "fs";
import path from "path";

/**
 * Durable, concurrency-safe collections shared by every store in the studio.
 *
 * One backend decision, one compare-and-set implementation, one file fallback —
 * so a second collection (jobs) cannot drift from the first (cuts).
 */

const MAX_CAS_RETRIES = 5;

// Compare-and-set: only write if the value is unchanged since our read
// (ARGV[1] = expected current value, '' when the key was absent).
const CAS_SCRIPT =
  "local cur = redis.call('GET', KEYS[1]) " +
  "if (cur == ARGV[1]) or (cur == false and ARGV[1] == '') then " +
  "redis.call('SET', KEYS[1], ARGV[2]) return 1 end return 0";

/**
 * Where the file backend writes.
 *
 * Read per call rather than captured at import: a module-level constant is
 * fixed by whichever test file imports first, which makes parallel test files
 * share one store and clobber each other. `EDITFORGE_DATA_DIR` lets each one
 * have its own.
 *
 * Vercel serverless has a read-only project dir; /tmp is the only writable
 * path there, and is ephemeral per instance.
 */
export function dataDir(): string {
  const override = process.env.EDITFORGE_DATA_DIR;
  if (override) return override;
  return process.env.VERCEL ? path.join("/tmp", "editforge-data") : path.join(process.cwd(), ".data");
}

const REST_PAIRS = [
  { url: "KV_REST_API_URL", token: "KV_REST_API_TOKEN" },
  { url: "UPSTASH_REDIS_REST_URL", token: "UPSTASH_REDIS_REST_TOKEN" },
] as const;

const KNOWN_STORE_ENV = [
  ...REST_PAIRS.flatMap((p) => [p.url, p.token]),
  "REDIS_URL",
  "KV_URL",
] as const;

/**
 * Vercel KV / Upstash Redis REST credentials. Marketplace stores attach either
 * naming scheme — accept either, but only as a complete url+token pair so the
 * schemes never mix and authenticate against the wrong host.
 */
export function kvCreds(): { url: string; token: string } | null {
  for (const p of REST_PAIRS) {
    const url = process.env[p.url];
    const token = process.env[p.token];
    if (url && token) return { url, token };
  }
  return null;
}

export function storeBackend(): "kv" | "file" {
  return kvCreds() ? "kv" : "file";
}

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

export async function kvCommand(cmd: string[]): Promise<unknown> {
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
    else await fs.mkdir(dataDir(), { recursive: true });
    return { backend, reachable: true };
  } catch (err) {
    return { backend, reachable: false, error: (err as Error).message };
  }
}

export type DurableCollection<T> = {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  /** Read → mutate in place → persist, atomically against concurrent writers. */
  mutate(fn: (items: T[]) => void): Promise<T[]>;
};

/**
 * Build a durable collection backed by Redis when configured, else a JSON file.
 *
 * `seed` runs only when the collection has never existed — on KV via a
 * first-writer-wins `SET NX`, on disk only for a genuine ENOENT, so a corrupt
 * store surfaces as an error instead of being silently replaced.
 */
export function durableCollection<T extends { id: string }>(opts: {
  /** Redis key, e.g. "editforge:cuts". */
  key: string;
  /** File basename under the data dir, e.g. "cuts.json". */
  file: string;
  seed: () => T[];
}): DurableCollection<T> {
  // The file backend needs the same read-modify-write isolation as KV. Without
  // this queue, concurrent requests can overwrite each other or race on the
  // collection's shared temporary filename.
  let fileMutation: Promise<void> = Promise.resolve();
  // Resolved per operation, not captured once: the collection is created at
  // module scope, so a captured path would freeze the data dir at import time.
  const filePath = () => path.join(dataDir(), opts.file);

  async function writeFile(items: T[]): Promise<void> {
    await fs.mkdir(dataDir(), { recursive: true });
    const target = filePath();
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(items, null, 2));
    await fs.rename(tmp, target);
  }

  async function readFile(): Promise<T[]> {
    await fs.mkdir(dataDir(), { recursive: true });
    let raw: string;
    try {
      raw = await fs.readFile(filePath(), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      const seeded = opts.seed();
      await writeFile(seeded);
      return seeded;
    }
    return JSON.parse(raw) as T[];
  }

  async function readAll(): Promise<T[]> {
    if (kvCreds()) {
      const raw = (await kvCommand(["GET", opts.key])) as string | null;
      if (raw != null) return JSON.parse(raw) as T[];
      // Atomic first-writer-wins seed, then re-read the canonical value.
      await kvCommand(["SET", opts.key, JSON.stringify(opts.seed()), "NX"]);
      const seeded = (await kvCommand(["GET", opts.key])) as string;
      return JSON.parse(seeded) as T[];
    }
    return readFile();
  }

  return {
    list: readAll,

    async get(id) {
      const items = await readAll();
      return items.find((i) => i.id === id) ?? null;
    },

    async mutate(fn) {
      if (kvCreds()) {
        for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
          const raw = (await kvCommand(["GET", opts.key])) as string | null;
          const items = raw == null ? opts.seed() : (JSON.parse(raw) as T[]);
          fn(items);
          const ok = await kvCommand([
            "EVAL",
            CAS_SCRIPT,
            "1",
            opts.key,
            raw ?? "",
            JSON.stringify(items),
          ]);
          if (ok === 1) return items;
        }
        throw new Error("KV update failed: concurrent-write retries exhausted");
      }
      let result: T[] = [];
      const transaction = fileMutation.then(async () => {
        const items = await readFile();
        fn(items);
        await writeFile(items);
        result = items;
      });
      // A rejected mutation must not poison later writes.
      fileMutation = transaction.then(
        () => undefined,
        () => undefined
      );
      await transaction;
      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Per-record collections
//
// The whole-blob collection above is correct but charges O(collection) per
// read and per write. For the job store — polled continuously by every open
// studio surface — that meant every poll transferred and re-serialized every
// job, and a canvas sync of N running jobs was N full-blob CAS transactions.
//
// `durableRecordCollection` keeps one key per record plus an index set. A
// single-record poll is a single-key GET/CAS. Reads fan out in parallel. The
// API mirrors the blob collection's semantics (CAS read-modify-write per
// record, race-safe insert), so callers keep the same concurrency story.
// ---------------------------------------------------------------------------

export type DurableRecordCollection<T extends { id: string; updatedAt?: string }> = {
  get(id: string): Promise<T | null>;
  getMany(ids: string[]): Promise<(T | null)[]>;
  list(): Promise<T[]>;
  /**
   * Read → mutate in place → persist one record, atomically against
   * concurrent writers of that record.
   */
  mutate(id: string, fn: (record: T) => void): Promise<T | null>;
  /**
   * Insert a record that must not already exist — CAS on the empty key, so of
   * two concurrent inserts exactly one wins. Returns the stored record.
   */
  insert(record: T): Promise<boolean>;
  remove(id: string): Promise<void>;
  /** Point lookup by the collection's idempotency field, when configured. */
  findByIdem(key: string): Promise<T | null>;
  /**
   * Drop the oldest removable records beyond a cap. Removable is caller-decided
   * (e.g. terminal jobs); ordering is by `updatedAt` ascending, newest kept.
   */
  trim(removable: (record: T) => boolean, keep: number): Promise<number>;
};

export function durableRecordCollection<T extends { id: string; updatedAt?: string }>(opts: {
  /** Redis key prefix, e.g. "editforge:jobs". */
  key: string;
  /** File basename under the data dir, e.g. "jobs.json". */
  file: string;
  idemOf?: (record: T) => string;
  /**
   * Legacy whole-blob key from the pre-record layout. When the record index is
   * empty, its contents are imported once and the blob deleted, so an existing
   * deployment upgrades in place instead of losing its jobs.
   */
  legacyKey?: string;
}): DurableRecordCollection<T> {
  const recordKey = (id: string) => `${opts.key}:rec:${encodeURIComponent(id)}`;
  const indexKey = () => `${opts.key}:index`;
  const idemKey = (idem: string) => `${opts.key}:idem:${encodeURIComponent(idem)}`;

  // Same isolation discipline as the blob collection's file backend.
  let fileMutation: Promise<unknown> = Promise.resolve();
  const filePath = () => path.join(dataDir(), opts.file);

  async function fileWrite(items: T[]): Promise<void> {
    await fs.mkdir(dataDir(), { recursive: true });
    const target = filePath();
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(items, null, 2));
    await fs.rename(tmp, target);
  }

  async function fileRead(): Promise<T[]> {
    await fs.mkdir(dataDir(), { recursive: true });
    try {
      return JSON.parse(await fs.readFile(filePath(), "utf8")) as T[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      await fileWrite([]);
      return [];
    }
  }

  /** Run one whole-file transaction, serialized against the others. */
  function fileTx<R>(fn: (items: T[]) => R | Promise<R>): Promise<R> {
    const run = fileMutation.then(async () => {
      const items = await fileRead();
      const out = await fn(items);
      await fileWrite(items);
      return out;
    });
    fileMutation = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function kvIndex(): Promise<string[]> {
    const members = (await kvCommand(["SMEMBERS", indexKey()])) as string[];
    return members ?? [];
  }

  async function kvImportLegacyIfNeeded(): Promise<void> {
    if (!opts.legacyKey) return;
    const members = await kvIndex();
    if (members.length > 0) return;
    const raw = (await kvCommand(["GET", opts.legacyKey])) as string | null;
    if (raw == null) return;
    const items = JSON.parse(raw) as T[];
    for (const item of items) {
      await kvCommand(["SET", recordKey(item.id), JSON.stringify(item)]);
      await kvCommand(["SADD", indexKey(), item.id]);
      if (opts.idemOf)
        await kvCommand(["SET", idemKey(opts.idemOf(item)), item.id]);
    }
    await kvCommand(["DEL", opts.legacyKey]);
  }

  const kv = {
    async get(id: string): Promise<T | null> {
      const raw = (await kvCommand(["GET", recordKey(id)])) as string | null;
      return raw == null ? null : (JSON.parse(raw) as T);
    },

    async list(): Promise<T[]> {
      await kvImportLegacyIfNeeded();
      const members = await kvIndex();
      const raws = await Promise.all(
        members.map((id) => kvCommand(["GET", recordKey(id)]) as Promise<string | null>),
      );
      return raws
        .filter((r): r is string => r != null)
        .map((r) => JSON.parse(r) as T);
    },

    async insert(record: T): Promise<boolean> {
      const ok = await kvCommand([
        "EVAL",
        CAS_SCRIPT,
        "1",
        recordKey(record.id),
        "", // must be absent to win
        JSON.stringify(record),
      ]);
      if (ok !== 1) return false;
      await kvCommand(["SADD", indexKey(), record.id]);
      if (opts.idemOf)
        await kvCommand(["SET", idemKey(opts.idemOf(record)), record.id]);
      return true;
    },

    async mutate(id: string, fn: (record: T) => void): Promise<T | null> {
      for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
        const raw = (await kvCommand(["GET", recordKey(id)])) as string | null;
        if (raw == null) return null;
        const record = JSON.parse(raw) as T;
        fn(record);
        const ok = await kvCommand([
          "EVAL",
          CAS_SCRIPT,
          "1",
          recordKey(id),
          raw,
          JSON.stringify(record),
        ]);
        if (ok === 1) return record;
      }
      throw new Error("Record update failed: concurrent-write retries exhausted");
    },

    async remove(id: string): Promise<void> {
      // Read before deleting: the idem pointer needs the record's own key.
      const raw = (await kvCommand(["GET", recordKey(id)])) as string | null;
      await kvCommand(["DEL", recordKey(id)]);
      if (raw && opts.idemOf)
        await kvCommand(["DEL", idemKey(opts.idemOf(JSON.parse(raw) as T))]);
      await kvCommand(["SREM", indexKey(), id]);
    },

    async findByIdem(idem: string): Promise<T | null> {
      if (!opts.idemOf) return null;
      const id = (await kvCommand(["GET", idemKey(idem)])) as string | null;
      return id ? kv.get(id) : null;
    },

    async trim(removable: (record: T) => boolean, keep: number): Promise<number> {
      const all = await kv.list();
      const excess = all
        .filter(removable)
        .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
        .slice(0, Math.max(0, all.filter(removable).length - keep));
      for (const record of excess) await kv.remove(record.id);
      return excess.length;
    },
  };

  const file = {
    async get(id: string): Promise<T | null> {
      return fileTx((items) => items.find((i) => i.id === id) ?? null);
    },
    async list(): Promise<T[]> {
      return fileTx((items) => [...items]);
    },
    async insert(record: T): Promise<boolean> {
      return fileTx((items) => {
        if (items.some((i) => i.id === record.id)) return false;
        items.unshift(record);
        return true;
      });
    },
    async mutate(id: string, fn: (record: T) => void): Promise<T | null> {
      return fileTx((items) => {
        const i = items.findIndex((r) => r.id === id);
        if (i < 0) return null;
        const next = { ...items[i] };
        fn(next);
        items[i] = next;
        return next;
      });
    },
    async remove(id: string): Promise<void> {
      await fileTx((items) => {
        const i = items.findIndex((r) => r.id === id);
        if (i >= 0) items.splice(i, 1);
      });
    },
    async findByIdem(idem: string): Promise<T | null> {
      if (!opts.idemOf) return null;
      return fileTx((items) => items.find((r) => opts.idemOf!(r) === idem) ?? null);
    },
    async trim(removable: (record: T) => boolean, keep: number): Promise<number> {
      return fileTx((items) => {
        const removableRecords = items
          .filter(removable)
          .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
        const excess = removableRecords.slice(0, Math.max(0, removableRecords.length - keep));
        for (const record of excess) {
          const i = items.findIndex((r) => r.id === record.id);
          if (i >= 0) items.splice(i, 1);
        }
        return excess.length;
      });
    },
  };

  const backing = () => (kvCreds() ? kv : file);

  return {
    get: (id) => backing().get(id),
    async getMany(ids) {
      if (!kvCreds()) {
        const all = await file.list();
        const map = new Map(all.map((r) => [r.id, r]));
        return ids.map((id) => map.get(id) ?? null);
      }
      return Promise.all(ids.map((id) => kv.get(id)));
    },
    list: () => backing().list(),
    insert: (r) => backing().insert(r),
    mutate: (id, fn) => backing().mutate(id, fn),
    remove: (id) => backing().remove(id),
    findByIdem: (k) => backing().findByIdem(k),
    trim: (removable, keep) => backing().trim(removable, keep),
  };
}
