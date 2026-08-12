import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data-test-vfx");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { GET, POST, PATCH } = await import("./route");

function req(method: string, body: Record<string, unknown>) {
  return new Request("http://localhost/api/vfx", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "vfx.json"), { force: true });
});

describe("the shot board", () => {
  it("moves a shot's status and keeps it moved", async () => {
    // The whole complaint about the old page: a board whose statuses could
    // never change is not a tracker.
    const res = await PATCH(req("PATCH", { id: "VFX_010", status: "wip" }));
    expect(res.status).toBe(200);

    const shots = (await (await GET()).json()).shots;
    expect(shots.find((s: { id: string }) => s.id === "VFX_010").status).toBe("wip");
  });

  it("refuses a status that is not on the board's ladder", async () => {
    const res = await PATCH(req("PATCH", { id: "VFX_010", status: "shipped" }));
    expect(res.status).toBe(400);
  });

  it("404s a shot that is not on the board", async () => {
    expect((await PATCH(req("PATCH", { id: "VFX_999", status: "wip" }))).status).toBe(404);
  });

  it("adds a shot, uppercasing the id that acts as the conform key", async () => {
    const res = await POST(req("POST", { id: "vfx_040", desc: "Sky replacement", engine: "Fusion" }));
    expect(res.status).toBe(201);
    expect((await res.json()).shot.id).toBe("VFX_040");
  });

  it("refuses a duplicate id rather than merging two shots into one", async () => {
    await POST(req("POST", { id: "VFX_040", desc: "Sky replacement", engine: "Fusion" }));
    const res = await POST(req("POST", { id: "VFX_040", desc: "Something else", engine: "Fusion" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already on the board/i);
  });

  it("refuses a shot with no id or no description", async () => {
    expect((await POST(req("POST", { id: "", desc: "x" }))).status).toBe(409);
    expect((await POST(req("POST", { id: "VFX_050", desc: "  " }))).status).toBe(409);
  });

  it("records a note against the status move", async () => {
    await PATCH(req("PATCH", { id: "VFX_020", status: "review", note: "Comp v3 out for notes" }));
    const shots = (await (await GET()).json()).shots;
    expect(shots.find((s: { id: string }) => s.id === "VFX_020").note).toBe("Comp v3 out for notes");
  });
});
