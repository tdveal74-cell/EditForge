import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Own data dir — test files run in parallel and would otherwise share a store.
const DATA_DIR = path.join(process.cwd(), ".data-test-dailies");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { GET, POST } = await import("./route");
const { upsertCut } = await import("@/lib/store");

function post(body: Record<string, unknown>) {
  return new Request("http://localhost/api/dailies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const now = new Date().toISOString();

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "dailies.json"), { force: true });
  await fs.rm(path.join(DATA_DIR, "cuts.json"), { force: true });
  await upsertCut({ id: "cut-x", title: "Target", status: "review", createdAt: now, updatedAt: now });
});

describe("the dailies gate", () => {
  it("refuses a roll that has not been reviewed", async () => {
    // "Nothing enters the cut unreviewed" — d-0811-a seeds as `review`.
    const res = await POST(post({ action: "select", id: "d-0811-a", cutId: "cut-x" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/no recorded approval/i);
  });

  it("lets an approved roll in", async () => {
    await POST(post({ action: "review", id: "d-0811-a", decision: "approve" }));
    const res = await POST(post({ action: "select", id: "d-0811-a", cutId: "cut-x" }));
    expect(res.status).toBe(200);
    expect((await res.json()).roll.selectedForCutId).toBe("cut-x");
  });

  it("refuses a rejected roll, and says it was rejected rather than unreviewed", async () => {
    await POST(post({ action: "review", id: "d-0811-a", decision: "reject", note: "Focus soft" }));
    const res = await POST(post({ action: "select", id: "d-0811-a", cutId: "cut-x" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/was rejected/i);
  });

  it("IGNORES a status the caller sends — approval is recorded, not asserted", async () => {
    // The failure this gate exists to prevent: a client claiming its own
    // approval, exactly as the export gate used to accept `rubricPass: true`.
    const res = await POST(post({ action: "select", id: "d-0811-b", cutId: "cut-x", status: "approved" }));
    expect(res.status).toBe(409);
  });

  it("pulls a roll back out of the cut when it is later rejected", async () => {
    // A roll that stayed in the cut after being rejected would mean the gate
    // only held at the moment of entry.
    await POST(post({ action: "review", id: "d-0811-a", decision: "approve" }));
    await POST(post({ action: "select", id: "d-0811-a", cutId: "cut-x" }));
    await POST(post({ action: "review", id: "d-0811-a", decision: "reject", note: "Recut" }));

    const rolls = (await (await GET()).json()).rolls;
    const roll = rolls.find((r: { id: string }) => r.id === "d-0811-a");
    expect(roll.status).toBe("rejected");
    expect(roll.selectedForCutId).toBeUndefined();
  });

  it("holds the invariant when a reject and a select race", async () => {
    // Whichever wins, the end state must never be "rejected and in a cut".
    // The approval check runs inside the atomic write for this reason: checking
    // first and writing after leaves a window where the reject lands between
    // the two and the select is written anyway.
    await POST(post({ action: "review", id: "d-0811-a", decision: "approve" }));

    await Promise.all([
      POST(post({ action: "select", id: "d-0811-a", cutId: "cut-x" })),
      POST(post({ action: "review", id: "d-0811-a", decision: "reject", note: "Pulled" })),
    ]);

    const rolls = (await (await GET()).json()).rolls;
    const roll = rolls.find((r: { id: string }) => r.id === "d-0811-a");
    if (roll.status === "rejected") expect(roll.selectedForCutId).toBeUndefined();
  });

  it("refuses to file a roll against a cut that does not exist", async () => {
    await POST(post({ action: "review", id: "d-0811-a", decision: "approve" }));
    const res = await POST(post({ action: "select", id: "d-0811-a", cutId: "ghost" }));
    expect(res.status).toBe(404);
  });

  it("keeps the reason with the decision", async () => {
    await POST(post({ action: "review", id: "d-0811-b", decision: "reject", note: "Boom in frame" }));
    const rolls = (await (await GET()).json()).rolls;
    expect(rolls.find((r: { id: string }) => r.id === "d-0811-b").reviewNote).toBe("Boom in frame");
  });

  it("rejects an unknown action and an unknown decision", async () => {
    expect((await POST(post({ action: "ship", id: "d-0811-a" }))).status).toBe(400);
    expect((await POST(post({ action: "review", id: "d-0811-a", decision: "maybe" }))).status).toBe(400);
  });

  it("404s a roll that is not in the store", async () => {
    expect((await POST(post({ action: "review", id: "nope", decision: "approve" }))).status).toBe(404);
  });
});
