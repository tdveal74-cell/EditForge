import { describe, expect, it } from "vitest";
import { buildExportCommand, buildProxyCommand, canRun } from "./ffmpeg";

describe("ffmpeg plans", () => {
  it("proxy does not require rubric", () => {
    const plan = buildProxyCommand("in.mp4", "out.mp4");
    expect(plan.requiresRubricPass).toBe(false);
    expect(canRun(plan, false)).toBe(true);
    expect(plan.command).toContain("ffmpeg");
  });

  it("export requires rubric pass", () => {
    const plan = buildExportCommand("in.mp4", "master.mp4");
    expect(plan.requiresRubricPass).toBe(true);
    expect(canRun(plan, false)).toBe(false);
    expect(canRun(plan, true)).toBe(true);
  });
});
