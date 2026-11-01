import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data-test-longform");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { getLongformProject, saveLongformProject } = await import("./longformstore");
const { SAMPLE_LONGFORM } = await import("./longform");

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "longform.json"), { force: true });
});

describe("longform store", () => {
  it("seeds the sample episode", async () => {
    const project = await getLongformProject();
    expect(project.id).toBe(SAMPLE_LONGFORM.id);
    expect(project.chapters[0].title).toBe("Cold open");
  });

  it("keeps edited chapters so reload is not SAMPLE_LONGFORM", async () => {
    const edited = {
      ...SAMPLE_LONGFORM,
      chapters: SAMPLE_LONGFORM.chapters.map((c) =>
        c.id === "ch-1" ? { ...c, title: "Operator cold open", script: "Rewritten hold." } : c
      ),
    };
    const saved = await saveLongformProject(edited);
    expect(saved.ok).toBe(true);
    const loaded = await getLongformProject();
    expect(loaded.chapters[0].title).toBe("Operator cold open");
    expect(loaded.chapters[0].script).toBe("Rewritten hold.");
    expect(loaded.chapters).toHaveLength(SAMPLE_LONGFORM.chapters.length);
  });

  it("refuses a body with no chapters rather than storing the sample", async () => {
    const res = await saveLongformProject({ title: "Empty" });
    expect(res.ok).toBe(false);
  });
});
