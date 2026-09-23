import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("Canvas tools", () => {
  const CANVAS_FILE = path.join(DATA_DIR, "canvas.json");
  beforeEach(async () => {
    await fs.rm(CANVAS_FILE, { force: true });
  });

  it("hides every Canvas tool from an unauthenticated caller and offers no render", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const open = await (await POST(rpc("tools/list"))).json();
    const openNames: string[] = open.result.tools.map((t: { name: string }) => t.name);
    expect(openNames.filter((n) => n.startsWith("canvas_"))).toEqual([]);

    const authed = await (await POST(rpc("tools/list", undefined, TOKEN))).json();
    const names: string[] = authed.result.tools.map((t: { name: string }) => t.name);
    expect(names.filter((n) => n.startsWith("canvas_")).sort()).toEqual([
      "canvas_create_project",
      "canvas_get_project",
      "canvas_list_projects",
      "canvas_render_plan",
      "canvas_save_project",
    ]);
    // Paid generation from Canvas stays with a signed-in person on the page.
    expect(names.some((n) => n.startsWith("canvas_") && /render(?!_plan)/.test(n))).toBe(false);
  });

  it("creates a project from a template with the brief written in, then reads it back", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const created = await callTool(
      "canvas_create_project",
      { templateId: "micro-drama", name: "TSWS test episode", brief: "Auren and Vespera at the threshold." },
      TOKEN,
    );
    expect(created.isError).toBe(false);
    const project = created.parsed.project;
    expect(project.name).toBe("TSWS test episode");
    expect(project.revision).toBe(1);
    expect(project.nodes.find((n: { kind: string }) => n.kind === "prompt").prompt).toBe(
      "Auren and Vespera at the threshold.",
    );

    const listed = await callTool("canvas_list_projects", {}, TOKEN);
    expect(listed.parsed.projects.map((p: { id: string }) => p.id)).toContain(project.id);
    expect(listed.parsed.templates.map((t: { id: string }) => t.id)).toContain("micro-drama");

    const read = await callTool("canvas_get_project", { id: project.id }, TOKEN);
    expect(read.parsed.project.id).toBe(project.id);
  });

  it("refuses an unknown template rather than silently using another", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const res = await callTool("canvas_create_project", { templateId: "nope" }, TOKEN);
    expect(res.parsed.error).toMatch(/templateId must be one of/);
  });

  it("saves an edit at the read revision and refuses a stale one", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const { parsed } = await callTool("canvas_create_project", { templateId: "micro-drama" }, TOKEN);
    const read = parsed.project;
    const edited = { ...read, name: "Renamed by a bot" };
    const saved = await callTool("canvas_save_project", { project: edited }, TOKEN);
    expect(saved.parsed.project.name).toBe("Renamed by a bot");
    expect(saved.parsed.project.revision).toBe(read.revision + 1);

    // The same stale revision again is a concurrent edit, not an overwrite.
    const stale = await callTool("canvas_save_project", { project: { ...read, name: "Lost update" } }, TOKEN);
    expect(stale.parsed.error).toMatch(/changed in another tab/);
    const after = await callTool("canvas_get_project", { id: read.id }, TOKEN);
    expect(after.parsed.project.name).toBe("Renamed by a bot");
  });

  it("previews a render plan without starting a job", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const { parsed } = await callTool("canvas_create_project", { templateId: "micro-drama" }, TOKEN);
    const node = parsed.project.nodes.find((n: { kind: string }) => ["image", "video", "voice"].includes(n.kind));
    const plan = await callTool("canvas_render_plan", { projectId: parsed.project.id, nodeIds: [node.id] }, TOKEN);
    expect(plan.isError).toBe(false);
    expect(plan.parsed.items).toHaveLength(1);
    expect(plan.parsed.items[0].nodeId).toBe(node.id);
    // The confirmation hash is what authorizes a paid render; it is not handed out.
    expect(plan.parsed.confirmation).toBeUndefined();
    const jobs = await callTool("list_jobs", {}, TOKEN);
    expect(jobs.parsed.jobs).toEqual([]);
  });
});

describe("Edit worker, catalog, stock and planner tools", () => {
  const EDIT_BASE = {
    schema: "editforge.edit-command.v1",
    projectId: "project-tqo-001",
    property: "tqo",
    deliverable: "long-form",
    issuedBy: "DEVON",
    source: { uri: "https://media.example/source.mp4", sha256: "a".repeat(64) },
    identity: { cloneId: "tee-clone-v1", voiceId: "tee-voice-v1", version: "tee-identity-v1", consentRecorded: true },
    canon: { version: "tqo-canon-v1", locked: true },
    authorization: { approvalId: "approval-001", approvedBy: "Tee", scopes: ["edit:*"] },
  };

  it("gates the edit worker and the catalog writes, and leaves the planners open", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const open = await (await POST(rpc("tools/list"))).json();
    const openNames: string[] = open.result.tools.map((t: { name: string }) => t.name);
    for (const gated of ["list_edits", "get_edit", "submit_edit", "drive_edit", "add_asset", "add_stock"]) {
      expect(openNames).not.toContain(gated);
    }
    for (const read of ["list_assets", "list_stock", "plan_gen_video", "plan_voice", "plan_avatar"]) {
      expect(openNames).toContain(read);
    }
  });

  it("refuses an invalid edit command before anything reaches the worker", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const res = await callTool("submit_edit", { command: { schema: "nope" } }, TOKEN);
    expect(res.parsed.error).toBe("invalid edit command");
    expect(res.parsed.executed).toBe(false);
  });

  it("refuses a master render without a recorded rubric pass", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    await upsertCut({ id: "cut-mcp-master", title: "No pass yet", status: "ingest", rubricPass: false } as never);
    const res = await callTool(
      "submit_edit",
      {
        command: {
          ...EDIT_BASE,
          commandId: "cmd-mcp-master-001",
          cutId: "cut-mcp-master",
          operations: [{ id: "op-master", type: "render-master", params: {} }],
          output: { mode: "master", width: 1920, height: 1080, fps: 24, container: "mp4" },
        },
      },
      TOKEN,
    );
    expect(res.parsed.error).toMatch(/master render blocked/);
    expect(res.parsed.executed).toBe(false);
    const edits = await callTool("list_edits", {}, TOKEN);
    expect(edits.parsed.executions.some((e: { commandId?: string }) => e.commandId === "cmd-mcp-master-001")).toBe(false);
  });

  it("answers a planner without submitting a job", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const plan = await callTool("plan_gen_video", { prompt: "Slow push in on a desk lamp", durationSec: 5 }, TOKEN);
    expect(plan.isError).toBe(false);
    expect(plan.parsed).toBeTruthy();
    expect(plan.parsed.error).toBeUndefined();
    const jobs = await callTool("list_jobs", {}, TOKEN);
    expect(jobs.parsed.jobs).toEqual([]);
  });

  it("refuses stock without a licence note", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const res = await callTool("add_stock", { kind: "music", title: "Test bed", licenseNote: " " }, TOKEN);
    expect(res.parsed.error).toMatch(/licen/i);
  });
});

describe("ship_to_n8n", () => {
  const ARGS = {
    frameId: "TQO-2026-09-24-first-cut",
    outputUrl: "https://editforge.online/api/artifacts/master.mp4",
    brand: "The Quiet Operator",
    approvedBy: "Tee in thread, 2026-09-24",
    slots: [{ platform: "TikTok", scheduledFor: "2026-09-25T13:00:00Z" }],
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EDITFORGE_N8N_HANDOFF_URL;
  });

  it("is hidden without the token", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const open = await (await POST(rpc("tools/list"))).json();
    expect(open.result.tools.map((t: { name: string }) => t.name)).not.toContain("ship_to_n8n");
  });

  it("posts the handoff to n8n signed with the server's own token", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    const seen: { url?: string; auth?: string; body?: unknown } = {};
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen.url = url;
      seen.auth = (init.headers as Record<string, string>).Authorization;
      seen.body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ ok: true, slots: ["TQO-2026-09-24-first-cut:TikTok"] }), { status: 200 });
    });
    const res = await callTool("ship_to_n8n", ARGS, TOKEN);
    expect(res.parsed.handedOff).toBe(true);
    expect(seen.url).toBe("https://n8n.editforge.online/webhook/bot-handoff");
    expect(seen.auth).toBe(`Bearer ${TOKEN}`);
    expect(seen.body).toEqual(ARGS);
  });

  it("reports an n8n refusal as an error, not a handoff", async () => {
    process.env.EDITFORGE_MCP_TOKEN = TOKEN;
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, error: "brand must be one of" }), { status: 400 }));
    const res = await callTool("ship_to_n8n", ARGS, TOKEN);
    expect(res.parsed.handedOff).toBeUndefined();
    expect(res.parsed.error).toBe("n8n answered HTTP 400");
  });
});
