import { afterEach, describe, expect, it, vi } from "vitest";
import { getCut, listCuts, setRubricPass, storeBackend, upsertCut } from "./store";

const KV_ENV = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];

function clearKvEnv() {
  for (const k of KV_ENV) delete process.env[k];
}

function useKvEnv() {
  process.env.KV_REST_API_URL = "https://kv.example.test";
  process.env.KV_REST_API_TOKEN = "secret-token";
}

// In-memory fake of the Upstash REST endpoint. Supports the commands the
// store issues: GET, SET (with NX), and the CAS EVAL script.
function mockKvFetch(db: Map<string, string>, hooks?: { beforeEval?: () => void }) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const cmd = JSON.parse(String(init?.body)) as string[];
    const [op] = cmd;
    let result: unknown = "OK";
    if (op === "GET") {
      result = db.get(cmd[1]) ?? null;
    } else if (op === "SET") {
      const [, key, value, flag] = cmd;
      if (flag === "NX" && db.has(key)) result = null;
      else db.set(key, value);
    } else if (op === "EVAL") {
      hooks?.beforeEval?.();
      const [, , , key, expected, next] = cmd;
      const cur = db.get(key) ?? "";
      if (cur === expected) {
        db.set(key, next);
        result = 1;
      } else {
        result = 0;
      }
    }
    return { ok: true, json: async () => ({ result }) } as Response;
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

  it("selects KV only for a complete credential pair — schemes never mix", () => {
    clearKvEnv();
    process.env.KV_REST_API_URL = "https://kv.example.test";
    process.env.KV_REST_API_TOKEN = "tok";
    expect(storeBackend()).toBe("kv");

    clearKvEnv();
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    expect(storeBackend()).toBe("kv");

    // Incomplete legacy pair + partial upstash pair must NOT count as configured.
    clearKvEnv();
    process.env.KV_REST_API_URL = "https://kv.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    expect(storeBackend()).toBe("file");
  });

  it("seeds KV atomically on first read and persists writes through it", async () => {
    useKvEnv();
    const db = new Map<string, string>();
    vi.stubGlobal("fetch", mockKvFetch(db));

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

  it("retries on CAS conflict so a concurrent write is never lost", async () => {
    useKvEnv();
    const db = new Map<string, string>();
    const now = new Date().toISOString();
    db.set("editforge:cuts", JSON.stringify([]));

    // Simulate another instance writing between our GET and EVAL — once.
    let interfered = false;
    const fetchMock = mockKvFetch(db, {
      beforeEval: () => {
        if (interfered) return;
        interfered = true;
        db.set(
          "editforge:cuts",
          JSON.stringify([{ id: "cut-concurrent", title: "Other writer", status: "ingest", createdAt: now, updatedAt: now }])
        );
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await upsertCut({ id: "cut-mine", title: "My write", status: "ingest", createdAt: now, updatedAt: now });

    const stored = JSON.parse(db.get("editforge:cuts")!) as { id: string }[];
    const ids = stored.map((c) => c.id);
    // Both writes survive: the conflicting one and ours, via retry.
    expect(ids).toContain("cut-concurrent");
    expect(ids).toContain("cut-mine");
  });

  it("sends the bearer token on every KV command", async () => {
    useKvEnv();
    const fetchMock = mockKvFetch(new Map());
    vi.stubGlobal("fetch", fetchMock);

    await listCuts();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit;
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    }
  });
});
