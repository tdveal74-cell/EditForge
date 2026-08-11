import { describe, expect, it } from "vitest";
import { DEFAULT_GRADE, isRestraintGrade } from "./grade";

describe("restraint grade", () => {
  it("default is inside envelope", () => {
    expect(isRestraintGrade(DEFAULT_GRADE)).toBe(true);
  });

  it("rejects hero exposure", () => {
    expect(isRestraintGrade({ ...DEFAULT_GRADE, exposure: 0.9 })).toBe(false);
  });
});
