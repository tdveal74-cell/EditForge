import { afterEach, describe, expect, it, vi } from "vitest";
import { getCut, listCuts, setRubricPass, storeBackend, upsertCut } from "./store";

const KV_ENV = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];

function clearKvEnv() {
  for (const k of KV_ENV) delete process.env[k];
}

// In-memory fake of the Upstash REST endpoint: accepts ["GET"|"SET", key, value?].
function mockKvFetch(db: Map<string, string>) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const [op, key, value] = JSON.parse(String(init?.body)) as string[];
    let result: string | null = "OK";
    if (op === "GET") result = db.get(key) ?? null;
    if (op === "SET") db.set(key, value);
    return {
      ok: true,
      json: async () => ({ result }),
    } as Response;
  });
}

afterEach(() => {
  clearKvEnv();
  vi.unstubAllGlobals();
});

describe("cuts store", () => {
  it("selects the file backend when no KV credentials are present", () => {
    clearKvEnv();
    expect(storeBackend()).toBe("file");
  });

  it("selects the KV backend for either credential naming scheme", () => {
    clearKvEnv();
    process.env.KV_REST_API_URL = "https://kv.example.test";
    process.env.KV_REST_API_TOKEN = "tok";
    expect(storeBackend()).toBe("kv");

    clearKvEnv();
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    expect(storeBackend()).toBe("kv");
  });

  it("seeds KV on first read and persists writes through it", async () => {
    process.env.KV_REST_API_URL = "https://kv.example.test";
    process.env.KV_REST_API_TOKEN = "tok";
    const db = new Map<string, string>();
    const fetchMock = mockKvFetch(db);
    vi.stubGlobal("fetch", fetchMock);

    const cuts = await listCuts();
    expect(cuts.length).toBe(3);
    expect(db.has("editforge:cuts")).toBe(true);

    const now = new Date().toISOString();
    await upsertCut({ id: "cut-test", title: "KV roundtrip", status: "ingest", createdAt: now, updatedAt: now });
    const fetched = await getCut("cut-test");
    expect(fetched?.title).toBe("KV roundtrip");

    const passed = await setRubricPass("cut-test", true);
    expect(passed?.rubricPass).toBe(true);
    expect(passed?.status).toBe("review");

    const stored = JSON.parse(db.get("editforge:cuts")!) as { id: string }[];
    expect(stored.some((c) => c.id === "cut-test")).toBe(true);
  });

  it("sends the bearer token on every KV command", async () => {
    process.env.KV_REST_API_URL = "https://kv.example.test";
    process.env.KV_REST_API_TOKEN = "secret-token";
    const fetchMock = mockKvFetch(new Map());
    vi.stubGlobal("fetch", fetchMock);

    await listCuts();
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit;
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    }
  });
});
