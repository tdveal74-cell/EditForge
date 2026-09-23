import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { GET, POST } from "./route";
// Safe as a static import despite the data dir being set below: the durable
// layer resolves its path per call, not at module load.
import { setRubricPass, upsertCut } from "@/lib/store";

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

  it("treats every studio write as mutating, not just the ones that spend money", async () => {
    // A roll approval and a shot status move change the studio's record. An
    // unauthenticated caller reading state is fine; one editing it is not.
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const open = await (await POST(rpc("tools/list"))).json();
    const openNames = open.result.tools.map((t: { name: string }) => t.name);
    for (const write of ["review_daily", "select_daily_for_cut", "move_vfx_shot"]) {
      expect(openNames).not.toContain(write);
    }
    // Reads and artifact builds stay available without a token.
    for (const read of ["list_dailies", "list_vfx_shots", "build_handoff"]) {
      expect(openNames).toContain(read);
    }
  });

  it("gates the source catalogue, which is a read but not a public one", async () => {
    // `/api/sources` answers an unauthenticated caller with a 401. The MCP
    // surface must not be the softer way in: source hashes are metadata about
    // media the studio deliberately does not publish.
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const open = await (await POST(rpc("tools/list"))).json();
    const openNames = open.result.tools.map((t: { name: string }) => t.name);
    expect(openNames).not.toContain("list_sources");

    const authed = await (await POST(rpc("tools/list", undefined, TOKEN))).json();
    const authedNames = authed.result.tools.map((t: { name: string }) => t.name);
    expect(authedNames).toContain("list_sources");
  });

  it("refuses a gated read without claiming it changes state", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const refused = await callTool("list_sources");
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("reads private data");
    expect(refused.text).not.toContain("changes state");
  });

  it("reports an unconfigured catalogue as configured:false, not as an error", async () => {
    // No media mounted is a normal deployment. A caller must be able to tell
    // that apart from a catalogue it is not allowed to read.
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    delete process.env.EDITFORGE_SOURCE_MEDIA_DIR;
    const result = await callTool("list_sources", {}, TOKEN);
    expect(result.isError).toBe(false);
    expect(result.parsed).toMatchObject({ configured: false, assets: [] });
  });

  it("lists a mounted asset with its content hash, not its filename", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const mediaDir = path.join(DATA_DIR, "sources");
    await fs.mkdir(mediaDir, { recursive: true });
    // Name the file after a hash that is not its content hash — the exact trap
    // the description warns about.
    await fs.writeFile(path.join(mediaDir, `${"a".repeat(64)}.MP4`), "not-really-video");
    process.env.EDITFORGE_SOURCE_MEDIA_DIR = mediaDir;

    const { parsed } = await callTool("list_sources", {}, TOKEN);
    expect(parsed.configured).toBe(true);
    expect(parsed.assets).toHaveLength(1);
    const [asset] = parsed.assets;
    expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(asset.sha256).not.toBe("a".repeat(64));
    expect(asset.uri).toBe(`editforge-source:///${"a".repeat(64)}.MP4`);
    expect(asset.byteLength).toBe("not-really-video".length);
    delete process.env.EDITFORGE_SOURCE_MEDIA_DIR;
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

  it("accepts the token in the URL, for clients that cannot send headers", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const res = await POST(
      new Request(`http://localhost/api/mcp?key=${TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })
    );
    const names = (await res.json()).result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("submit_media_job");
  });

  it("refuses a wrong token in the URL", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const res = await POST(
      new Request("http://localhost/api/mcp?key=not-the-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })
    );
    const names = (await res.json()).result.tools.map((t: { name: string }) => t.name);
    expect(names).not.toContain("submit_media_job");
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

  it("refuses a master export plan that names no cut", async () => {
    const blocked = await callTool("plan_transcode", {
      kind: "export",
      inputPath: "in.mp4",
      outputPath: "master.mp4",
    });
    expect(blocked.parsed.allowed).toBe(false);
    expect(blocked.parsed.reason).toMatch(/must name the cut/i);
  });

  it("IGNORES a rubricPass sent by the assistant", async () => {
    // This tool used to take `rubricPass` and hand it to the gate, so an
    // assistant could authorise its own master export by asserting the cut had
    // passed. Same hole the HTTP route had, on the surface an assistant drives.
    await upsertCut({
      id: "mcp-unapproved",
      title: "Unapproved",
      status: "review",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await callTool("plan_transcode", {
      kind: "export",
      inputPath: "in.mp4",
      outputPath: "master.mp4",
      cutId: "mcp-unapproved",
      rubricPass: true,
    });
    expect(res.parsed.allowed).toBe(false);
    expect(res.parsed.reason).toMatch(/no recorded rubric pass/i);
  });

  it("allows the export once the pass is recorded on that cut", async () => {
    const now = new Date().toISOString();
    await upsertCut({ id: "mcp-approved", title: "Approved", status: "review", createdAt: now, updatedAt: now });
    await setRubricPass("mcp-approved", true);

    const res = await callTool("plan_transcode", {
      kind: "export",
      inputPath: "in.mp4",
      outputPath: "master.mp4",
      cutId: "mcp-approved",
    });
    expect(res.parsed.allowed).toBe(true);
    expect(res.parsed.cut.rubricPass).toBe(true);
  });

  it("404s a cut that is not in the store rather than defaulting to permitted", async () => {
    const res = await callTool("plan_transcode", {
      kind: "export",
      inputPath: "in.mp4",
      outputPath: "master.mp4",
      cutId: "ghost",
    });
    expect(res.parsed.allowed).toBe(false);
    expect(res.parsed.reason).toMatch(/no cut/i);
  });

  it("leaves proxies ungated", async () => {
    const res = await callTool("plan_transcode", {
      kind: "proxy",
      inputPath: "in.mp4",
      outputPath: "proxy.mp4",
    });
    expect(res.parsed.allowed).toBe(true);
  });
});

describe("the studio's other gates, over MCP", () => {
  beforeEach(async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    await fs.rm(path.join(DATA_DIR, "dailies.json"), { force: true });
    await fs.rm(path.join(DATA_DIR, "vfx.json"), { force: true });
  });

  it("refuses to select an unreviewed roll into a cut", async () => {
    // The same refusal the web app gives, on the surface an assistant drives.
    const res = await callTool("select_daily_for_cut", { id: "d-0811-a", cutId: "cut-01" }, TOKEN);
    expect(res.parsed.allowed).toBe(false);
    expect(res.parsed.reason).toMatch(/no recorded approval/i);
  });

  it("lets an approved roll in, and records the reason with the decision", async () => {
    const reviewed = await callTool(
      "review_daily",
      { id: "d-0811-a", decision: "approve", note: "Focus good" },
      TOKEN
    );
    expect(reviewed.parsed.roll.reviewNote).toBe("Focus good");

    const res = await callTool("select_daily_for_cut", { id: "d-0811-a", cutId: "cut-01" }, TOKEN);
    expect(res.parsed.allowed).toBe(true);
  });

  it("refuses to file a roll against a cut that does not exist", async () => {
    await callTool("review_daily", { id: "d-0811-a", decision: "approve" }, TOKEN);
    const res = await callTool("select_daily_for_cut", { id: "d-0811-a", cutId: "ghost" }, TOKEN);
    expect(res.parsed.error).toMatch(/no cut/i);
  });

  it("moves a shot on the board and refuses an unknown status", async () => {
    const moved = await callTool("move_vfx_shot", { action: "status", id: "VFX_010", status: "wip" }, TOKEN);
    expect(moved.parsed.shot.status).toBe("wip");

    const bad = await callTool("move_vfx_shot", { action: "status", id: "VFX_010", status: "shipped" }, TOKEN);
    expect(bad.parsed.error).toMatch(/status must be one of/i);
  });

  it("refuses a duplicate shot id rather than merging two shots", async () => {
    const res = await callTool("move_vfx_shot", { action: "add", id: "VFX_010", desc: "Clash" }, TOKEN);
    expect(res.parsed.error).toMatch(/already on the board/i);
  });

  it("builds an EDL an assistant can hand straight to a conform", async () => {
    const res = await callTool("build_handoff", { kind: "edl", cutId: "cut-01", fps: 24 });
    expect(res.parsed.filename).toMatch(/\.edl$/);
    expect(res.parsed.content).toContain("FCM: NON-DROP FRAME");
    expect(res.parsed.content).toContain("* TIMEBASE: 24 FPS");
  });

  it("refuses a timebase it does not compute correctly", async () => {
    const res = await callTool("build_handoff", { kind: "edl", cutId: "cut-01", fps: 29.97 });
    expect(res.parsed.error).toMatch(/fps must be one of/i);
  });

  it("says which assembly the artifact was built from", async () => {
    const res = await callTool("build_handoff", { kind: "stems", cutId: "cut-01" });
    expect(res.parsed.assemblySource).toBe("sample assembly");
  });

  it("carries the VFX board into the shot package", async () => {
    await callTool("move_vfx_shot", { action: "status", id: "VFX_020", status: "review" }, TOKEN);
    const res = await callTool("build_handoff", { kind: "shots", cutId: "cut-01" });
    const pkg = JSON.parse(res.parsed.content);
    expect(pkg.board.find((b: { id: string }) => b.id === "VFX_020").status).toBe("review");
  });

  it("404s a cut that is not in the store", async () => {
    const res = await callTool("build_handoff", { kind: "edl", cutId: "ghost" });
    expect(res.parsed.error).toMatch(/no cut/i);
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
