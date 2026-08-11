import { describe, expect, it } from "vitest";
import { RESTRAINT_RUBRIC, allRequiredPass } from "./restraint";

describe("restraint rubric", () => {
  it("fails when empty", () => {
    expect(allRequiredPass({})).toBe(false);
  });

  it("passes when all required true", () => {
    const results: Record<string, boolean> = {};
    for (const c of RESTRAINT_RUBRIC) {
      if (c.required) results[c.id] = true;
    }
    expect(allRequiredPass(results)).toBe(true);
  });
});
