import { describe, expect, it } from "vitest";
import {
  SAMPLE_LONGFORM,
  buildStitchCommand,
  longformStrategy,
  parseLongformProject,
  totalChapterDuration,
} from "./longform";

describe("longform", () => {
  it("sums chapter durations", () => {
    expect(totalChapterDuration(SAMPLE_LONGFORM.chapters)).toBeGreaterThan(600);
  });

  it("stitch requires rubric", () => {
    const plan = buildStitchCommand(["a.mp4", "b.mp4"], "out.mp4");
    expect(plan.requiresRubricPass).toBe(true);
    expect(plan.command).toContain("ffmpeg");
  });

  it("strategy scales with length", () => {
    expect(longformStrategy(60)).toMatch(/stitch/i);
    expect(longformStrategy(40 * 60)).toMatch(/NLE/i);
  });
});

describe("parseLongformProject", () => {
  it("refuses an empty body rather than substituting the sample", () => {
    const res = parseLongformProject({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/chapters required/);
  });

  it("keeps the edited title", () => {
    const res = parseLongformProject({
      ...SAMPLE_LONGFORM,
      chapters: [{ ...SAMPLE_LONGFORM.chapters[0], title: "Operator rewrite" }],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.project.chapters[0].title).toBe("Operator rewrite");
  });
});
