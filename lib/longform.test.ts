import { describe, expect, it } from "vitest";
import {
  SAMPLE_LONGFORM,
  buildStitchCommand,
  longformStrategy,
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
