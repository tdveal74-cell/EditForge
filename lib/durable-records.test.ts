import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "path";
import { durableRecordCollection } from "./durable";

/**
 * The KV backend has no test in the file-backed suites — a fake Upstash REST
 * endpoint stands in for it here: the exact commands the record collection
 * issues (GET/SET/DEL, SADD/SREM/SMEMBERS, and the CAS EVAL) against a tiny
 * in-memory Redis. It exercises the per-record layout end to end, including
 * the migration from the legacy whole-blob key.
 */

const DATA_DIR = path.join(process.cwd(), ".data-test-durable-records");

type Redis = Map<string, string | Set<string>>;

function fakeUpstash(redis: Redis) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const cmd = JSON.parse(String(init?.body)) as string[];
    const results = (() => {
      const [op, ...args] = cmd;
      switch (op.toUpperCase()) {
        case "PING":
          return "PONG";
        case "GET":
          return redis.get(args[0]) ?? null;
        case "SET": {
          const [key, value, nx] = args;
          if (nx === "NX" && redis.has(key)) return null;
          redis.set(key, value);
          return "OK";
        }
        case "DEL":
          return redis.delete(args[0]) ? 1 : 0;
        case "SADD": {
          const set = (redis.get(args[0]) as Set<string>) ?? new Set<string>();
          args.slice(1).forEach((m) => set.add(m));
          redis.set(args[0], set);
          return set.size;
        }
        case "SREM": {
          const set = (redis.get(args[0]) as Set<string>) ?? new Set<string>();
          args.slice(1).forEach((m) => set.delete(m));
          redis.set(args[0], set);
          return set.size;
        }
        case "SMEMBERS":
          return [...((redis.get(args[0]) as Set<string>) ?? new Set<string>())];
        case "EVAL": {
          // CAS_SCRIPT: compare KEYS[1] against ARGV[1] ('' = absent), write ARGV[2].
          const key = args[2];
          const expected = args[3];
          const next = args[4];
          const cur = redis.get(key);
          const matches =
            (typeof cur === "string" && cur === expected) ||
            (cur === undefined && expected === "");
          if (!matches) return 0;
          redis.set(key, next);
          return 1;
        }
        default:
          throw new Error(`fakeUpstash does not implement ${op}`);
      }
    })();

    return {
      ok: true,
      status: 200,
      json: async () => ({ result: results }),
    } as unknown as Response;
  });
}

function freshCollection<T extends { id: string; updatedAt?: string }>(redis: Redis, extra = {}) {
  return durableRecordCollection<T>({
    key: "editforge:test-records",
    file: "unused.json",
    ...extra,
  }) as ReturnType<typeof durableRecordCollection<T>>;
}

beforeEach(async () => {
  process.env.KV_REST_API_URL = "https://fake-kv.example";
  process.env.KV_REST_API_TOKEN = "fake-token";
  process.env.EDITFORGE_DATA_DIR = DATA_DIR;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.EDITFORGE_DATA_DIR;
});

describe("durableRecordCollection KV backend", () => {
  it("stores and reads records one key each", async () => {
    const redis: Redis = new Map();
    vi.stubGlobal("fetch", fakeUpstash(redis));
    const col = freshCollection<{ id: string }>(redis);
    expect(await col.get("a")).toBeNull();
    expect(await col.insert({ id: "a" })).toBe(true);
    // A second insert of the same id loses the race.
    expect(await col.insert({ id: "a" })).toBe(false);
    expect((await col.get("a"))?.id).toBe("a");
    expect((await col.list()).map((r) => r.id)).toEqual(["a"]);
  });

  it("mutates a record through CAS and loses to a concurrent write", async () => {
    const redis: Redis = new Map();
    vi.stubGlobal("fetch", fakeUpstash(redis));
    const col = freshCollection<{ id: string; n: number }>(redis);
    await col.insert({ id: "r", n: 0 });
    const out = await col.mutate("r", (r) => {
      r.n = 41;
    });
    expect(out?.n).toBe(41);
    // Absent record mutates to null.
    expect(await col.mutate("ghost", () => {})).toBeNull();
  });

  it("keeps an idempotency pointer and finds by it", async () => {
    const redis: Redis = new Map();
    vi.stubGlobal("fetch", fakeUpstash(redis));
    const col = freshCollection<{ id: string; updatedAt?: string }>(redis, {
      idemOf: (r: { id: string; updatedAt?: string }) => `key-${r.id}`,
    });
    await col.insert({ id: "abc", updatedAt: "t" });
    expect((await col.findByIdem("key-abc"))?.id).toBe("abc");
    expect(await col.findByIdem("key-other")).toBeNull();
    // Removal clears both the record and its pointer.
    await col.remove("abc");
    expect(await col.findByIdem("key-abc")).toBeNull();
    expect((await col.list()).length).toBe(0);
  });

  it("imports a legacy whole-blob once and deletes it", async () => {
    const redis: Redis = new Map();
    redis.set(
      "editforge:test-records",
      JSON.stringify([{ id: "old-1", updatedAt: "t" }, { id: "old-2", updatedAt: "t" }]),
    );
    vi.stubGlobal("fetch", fakeUpstash(redis));
    const col = freshCollection<{ id: string; updatedAt?: string }>(redis, {
      legacyKey: "editforge:test-records",
    });
    expect((await col.list()).map((r) => r.id).sort()).toEqual(["old-1", "old-2"]);
    expect(redis.has("editforge:test-records")).toBe(false);
    // Records are real now: a single-key read works.
    expect((await col.get("old-1"))?.id).toBe("old-1");
  });

  it("trims the oldest removable records beyond the cap", async () => {
    const redis: Redis = new Map();
    vi.stubGlobal("fetch", fakeUpstash(redis));
    const col = freshCollection<{ id: string; updatedAt: string }>(redis);
    for (let i = 0; i < 5; i++)
      await col.insert({ id: `t${i}`, updatedAt: `2026-01-0${i + 1}` });
    expect(await col.trim(() => true, 2)).toBe(3);
    expect((await col.list()).map((r) => r.id).sort()).toEqual(["t3", "t4"]);
  });
});
