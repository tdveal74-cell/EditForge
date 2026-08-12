import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Own data dir — test files run in parallel and would otherwise share a store.
const DATA_DIR = path.join(process.cwd(), ".data-test-ffmpeg");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { POST } = await import("./route");
const { upsertCut, setRubricPass } = await import("@/lib/store");

function plan(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ffmpeg/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const now = new Date().toISOString();

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "cuts.json"), { force: true });
});

describe("export gate", () => {
  it("refuses a master export for a cut with no recorded rubric pass", async () => {
    await upsertCut({ id: "c1", title: "Cold open", status: "review", createdAt: now, updatedAt: now });

    const res = await POST(plan({ kind: "export", cutId: "c1" }));
    const body = await res.json();

    expect(body.allowed).toBe(false);
    expect(body.reason).toMatch(/no recorded rubric pass/i);
  });

  it("allows it once the pass is recorded on that cut", async () => {
    await upsertCut({ id: "c2", title: "Master", status: "review", createdAt: now, updatedAt: now });
    await setRubricPass("c2", true);

    const body = await (await POST(plan({ kind: "export", cutId: "c2" }))).json();

    expect(body.allowed).toBe(true);
    expect(body.cut.rubricPass).toBe(true);
  });

  it("IGNORES a rubricPass sent by the caller", async () => {
    // The whole point. The gate previously read this straight off the body, so
    // anyone could authorise their own master export by asserting they had
    // passed. It must now be inert.
    await upsertCut({ id: "c3", title: "Unapproved", status: "review", createdAt: now, updatedAt: now });

    const body = await (await POST(plan({ kind: "export", cutId: "c3", rubricPass: true }))).json();

    expect(body.allowed).toBe(false);
  });

  it("refuses an export that names no cut, rather than defaulting to permitted", async () => {
    const res = await POST(plan({ kind: "export" }));
    expect(res.status).toBe(400);
    expect((await res.json()).allowed).toBe(false);
  });

  it("refuses an export naming a cut that is not in the store", async () => {
    const res = await POST(plan({ kind: "export", cutId: "ghost" }));
    expect(res.status).toBe(404);
    expect((await res.json()).allowed).toBe(false);
  });

  it("leaves proxies ungated — a proxy is not a deliverable", async () => {
    // Gating proxies would push editors to skip the rubric rather than respect
    // it, because they need a proxy long before a cut is ready to judge.
    const body = await (await POST(plan({ kind: "proxy" }))).json();
    expect(body.allowed).toBe(true);
    expect(body.plan.id).toBe("proxy");
  });

  it("still returns the command when it refuses, so the operator can see what was blocked", async () => {
    await upsertCut({ id: "c4", title: "Blocked", status: "review", createdAt: now, updatedAt: now });
    const body = await (await POST(plan({ kind: "export", cutId: "c4" }))).json();
    expect(body.allowed).toBe(false);
    expect(body.plan.command).toContain("ffmpeg");
  });
});
