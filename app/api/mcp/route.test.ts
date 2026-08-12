import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { GET, POST } from "./route";

const TOKEN = "test-token-value";

// Own data dir: test files run in parallel, and sharing one store means two
// files racing on the same jobs.json.
const DATA_DIR = path.join(process.cwd(), ".data-test-mcp");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

function rpc(method: string, params?: Record<string, unknown>, token?: string) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

/** Tool results come back as a JSON string inside the content block. */
async function callTool(name: string, args: Record<string, unknown> = {}, token?: string) {
  const res = await POST(rpc("tools/call", { name, arguments: args }, token));
  const body = await res.json();
  const text = body.result.content[0].text;
  try {
    return { parsed: JSON.parse(text), isError: Boolean(body.result.isError), text };
  } catch {
    return { parsed: null, isError: Boolean(body.result.isError), text };
  }
}

beforeEach(async () => {
  await fs.rm(JOBS_FILE, { force: true });
  delete process.env.EDITFORGE_MCP_TOKEN;
});

afterEach(() => {
  delete process.env.EDITFORGE_MCP_TOKEN;
});

describe("MCP transport", () => {
  it("initializes with a protocol version and server identity", async () => {
    const body = await (await POST(rpc("initialize"))).json();
    expect(body.result.protocolVersion).toBeTruthy();
    expect(body.result.serverInfo.name).toBe("editforge");
    expect(body.result.capabilities.tools).toBeTruthy();
  });

  it("answers in the client's protocol revision when it can speak it", async () => {
    const older = await (await POST(rpc("initialize", { protocolVersion: "2024-11-05" }))).json();
    expect(older.result.protocolVersion).toBe("2024-11-05");

    // An unknown revision gets ours, rather than an echo of something we cannot speak.
    const unknown = await (await POST(rpc("initialize", { protocolVersion: "1999-01-01" }))).json();
    expect(unknown.result.protocolVersion).toBe("2025-06-18");
  });

  it("answers ping and acknowledges notifications without a body", async () => {
    expect((await (await POST(rpc("ping"))).json()).result).toEqual({});
    const notified = await POST(rpc("notifications/initialized"));
    expect(notified.status).toBe(202);
  });

  it("reports an unknown method as a JSON-RPC error", async () => {
    const body = await (await POST(rpc("nonsense/method"))).json();
    expect(body.error.code).toBe(-32601);
  });

  it("declines a GET rather than holding a stream that would stay silent", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});

describe("MCP authentication", () => {
  it("hides mutating tools from an unauthenticated caller", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const body = await (await POST(rpc("tools/list"))).json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("list_jobs");
    expect(names).not.toContain("submit_media_job");
    expect(names).not.toContain("drive_job");
  });

  it("offers mutating tools once the bearer token matches", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const body = await (await POST(rpc("tools/list", undefined, TOKEN))).json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("submit_media_job");
  });

  it("refuses a wrong token, and a token of a different length", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    for (const bad of ["wrong-token-val", "x", `${TOKEN}extra`]) {
      const body = await (await POST(rpc("tools/list", undefined, bad))).json();
      const names = body.result.tools.map((t: { name: string }) => t.name);
      expect(names).not.toContain("submit_media_job");
    }
  });

  it("grants nobody write access when no token is configured", async () => {
    delete process.env.EDITFORGE_MCP_TOKEN;
    const body = await (await POST(rpc("tools/list", undefined, "anything"))).json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).not.toContain("submit_media_job");
  });

  it("refuses a gated tool call and says why, rather than pretending it is unknown", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const { isError, text } = await callTool("submit_media_job", { kind: "voice", prompt: "x" });
    expect(isError).toBe(true);
    expect(text).toMatch(/requires authentication/i);

    // And nothing was created by the refused call.
    const { parsed } = await callTool("list_jobs");
    expect(parsed.jobs).toHaveLength(0);
  });
});

describe("MCP tools", () => {
  it("never exposes a credential value through status", async () => {
    process.env.RUNWAY_API_KEY = "sk-secret-do-not-leak";
    const { parsed, text } = await callTool("editforge_status");
    expect(text).not.toContain("sk-secret-do-not-leak");
    const runway = parsed.providers.find((p: { id: string }) => p.id === "runway");
    expect(runway.credentialSet).toBe(true);
    expect(runway.credentialVar).toBe("RUNWAY_API_KEY");
    delete process.env.RUNWAY_API_KEY;
  });

  it("judges a grade against the restraint envelope", async () => {
    const inside = await callTool("check_restraint_grade", { exposure: 0.05 });
    expect(inside.parsed.withinEnvelope).toBe(true);

    const outside = await callTool("check_restraint_grade", { exposure: 0.45 });
    expect(outside.parsed.withinEnvelope).toBe(false);
  });

  it("returns the rubric checklist, and evaluates results against it", async () => {
    const list = await callTool("restraint_rubric");
    expect(list.parsed.checks.length).toBeGreaterThan(0);

    const partial = await callTool("restraint_rubric", { results: { "subtle-grade": true } });
    expect(partial.parsed.passed).toBe(false);
    expect(partial.parsed.missing.length).toBeGreaterThan(0);
  });

  it("refuses a master export plan without a rubric pass", async () => {
    const blocked = await callTool("plan_transcode", {
      kind: "export",
      inputPath: "in.mp4",
      outputPath: "master.mp4",
    });
    expect(blocked.parsed.allowed).toBe(false);
    expect(blocked.parsed.reason).toMatch(/rubric/i);

    const allowed = await callTool("plan_transcode", {
      kind: "export",
      inputPath: "in.mp4",
      outputPath: "master.mp4",
      rubricPass: true,
    });
    expect(allowed.parsed.allowed).toBe(true);
  });

  it("runs a job through the mock provider and dedupes a repeated brief", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const first = await callTool(
      "submit_media_job",
      { kind: "voice", prompt: "Where are we today?", provider: "mock" },
      TOKEN
    );
    expect(first.parsed.job.status).toBe("running");
    expect(first.parsed.job.mode).toBe("mock");

    const again = await callTool(
      "submit_media_job",
      { kind: "voice", prompt: "Where are we today?", provider: "mock" },
      TOKEN
    );
    expect(again.parsed.job.id).toBe(first.parsed.job.id);

    const polled = await callTool("drive_job", { id: first.parsed.job.id, action: "poll" }, TOKEN);
    expect(polled.parsed.job.status).toBe("validating");
  });

  it("surfaces an illegal transition as a refusal, not a crash", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const job = await callTool("submit_media_job", { kind: "voice", prompt: "x", provider: "mock" }, TOKEN);
    const bad = await callTool("drive_job", { id: job.parsed.job.id, action: "complete" }, TOKEN);
    expect(bad.parsed.error).toMatch(/Illegal job transition/);
  });

  it("refuses rubric-gated work submitted without a decision", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const res = await callTool(
      "submit_media_job",
      { kind: "gen-video", prompt: "master insert", provider: "mock", requiresRubricPass: true },
      TOKEN
    );
    expect(res.parsed.error).toMatch(/Rubric pass/);
  });
});
