import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Own data dir so this file does not race the other job-writing suites.
const DATA_DIR = path.join(process.cwd(), ".data-test-jobsapi");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

// Route handlers read cookies via next/headers, which has no request context
// under vitest; stub it so the spend gate can be exercised directly.
const cookieJar = { value: "" };
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieJar.value ? { value: cookieJar.value } : undefined) }),
}));

const { POST } = await import("./route");

function submit(body: Record<string, unknown>, token?: string) {
  return new Request("http://localhost/api/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "jobs.json"), { force: true });
  cookieJar.value = "";
  delete process.env.EDITFORGE_MCP_TOKEN;
  delete process.env.RUNWAY_API_KEY;
});

afterEach(() => {
  delete process.env.EDITFORGE_MCP_TOKEN;
  delete process.env.RUNWAY_API_KEY;
});

describe("spend gate on POST /api/jobs", () => {
  it("lets anyone reach the offline provider", async () => {
    const res = await POST(submit({ kind: "voice", prompt: "x", provider: "mock", idempotencyKey: "open-1" }));
    expect(res.status).toBe(201);
  });

  it("refuses a billable provider without credentials to authenticate with", async () => {
    process.env.RUNWAY_API_KEY = "live-key";

    const res = await POST(
      submit({ kind: "gen-video", prompt: "x", provider: "runway", idempotencyKey: "billable-1" })
    );

    // The property that matters: a live key on a reachable deployment is
    // unusable by anyone rather than usable by everyone.
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/requires authentication/i);
  });

  it("allows a billable provider once the MCP bearer token matches", async () => {
    process.env.RUNWAY_API_KEY = "live-key";
    process.env.EDITFORGE_MCP_TOKEN = "tok-abcdef";

    // Never actually reach Runway from a test.
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ id: "task_1" }) }) as unknown as Response));

    const res = await POST(
      submit({ kind: "gen-video", prompt: "x", provider: "runway", idempotencyKey: "billable-2" }, "tok-abcdef")
    );
    expect(res.status).toBe(201);
    const { job } = await res.json();
    expect(job.mode).toBe("live");
    vi.unstubAllGlobals();
  });

  it("refuses a billable provider when the bearer token is wrong", async () => {
    process.env.RUNWAY_API_KEY = "live-key";
    process.env.EDITFORGE_MCP_TOKEN = "tok-abcdef";

    const res = await POST(
      submit({ kind: "gen-video", prompt: "x", provider: "runway", idempotencyKey: "billable-3" }, "tok-wrongxx")
    );
    expect(res.status).toBe(401);
  });

  it("does not gate a provider that has no credentials — it cannot bill anyway", async () => {
    delete process.env.RUNWAY_API_KEY;
    // Reaches the boundary, which refuses it for the honest reason.
    const res = await POST(
      submit({ kind: "gen-video", prompt: "x", provider: "runway", idempotencyKey: "nokey-1" })
    );
    expect(res.status).toBe(201);
    const { job } = await res.json();
    expect(job.status).toBe("failed");
    expect(job.error).toContain("RUNWAY_API_KEY");
  });
});
