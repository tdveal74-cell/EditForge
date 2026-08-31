import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data-test-longform-plan");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { POST } = await import("./route");
const { SAMPLE_LONGFORM } = await import("@/lib/longform");
const { upsertCut, setRubricPass } = await import("@/lib/store");

function plan(body: unknown) {
  return POST(
    new Request("http://localhost/api/longform/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "cuts.json"), { force: true });
  const now = new Date().toISOString();
  await upsertCut({
    id: "cut-01",
    title: "TSWS E01 cold open",
    status: "review",
    createdAt: now,
    updatedAt: now,
  });
});

describe("POST /api/longform/plan", () => {
  it("plans the edited chapters, not SAMPLE_LONGFORM", async () => {
    const edited = {
      ...SAMPLE_LONGFORM,
      title: "Operator rewrite",
      chapters: [
        {
          id: "ch-x",
          title: "Edited cold open",
          startSec: 0,
          targetDurationSec: 12,
          script: "hello",
          segmentSource: "nle" as const,
        },
      ],
    };
    const res = await plan({ project: edited, cutId: "cut-01" });
    const json = await res.json();
    expect(json.chapters).toHaveLength(1);
    expect(json.chapters[0].title).toBe("Edited cold open");
    expect(json.project.title).toBe("Operator rewrite");
    expect(JSON.stringify(json)).not.toMatch(/Cold open/);
    expect(json.project.chapterCount).toBe(1);
  });

  it("ignores body.rubricPass and stays blocked without a recorded cut pass", async () => {
    const res = await plan({ project: SAMPLE_LONGFORM, rubricPass: true });
    const json = await res.json();
    expect(json.allowed).toBe(false);
    expect(json.note).toMatch(/name the cut/);
    expect(json.chapters[0].title).toBe(SAMPLE_LONGFORM.chapters[0].title);
  });

  it("authorises stitch only from the cut's recorded rubric pass", async () => {
    const blocked = await (await plan({ project: SAMPLE_LONGFORM, cutId: "cut-01" })).json();
    expect(blocked.allowed).toBe(false);

    await setRubricPass("cut-01", true);
    const allowed = await (await plan({ project: SAMPLE_LONGFORM, cutId: "cut-01" })).json();
    expect(allowed.allowed).toBe(true);
    expect(allowed.cut.rubricPass).toBe(true);
  });

  it("refuses a body with no chapters rather than planning the sample", async () => {
    const res = await plan({ rubricPass: true });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/chapters required/);
  });
});
