import { describe, expect, it } from "vitest";
import {
  ENGINE_CAPABILITIES,
  capabilitiesFor,
  paidProvidersAreDisabled,
  zeroCostProviders,
} from "./engine-capabilities";

describe("engine capability registry", () => {
  it("gives all three canonical engines a capability surface", () => {
    for (const engine of ["persona", "cinema", "edit"] as const) {
      expect(capabilitiesFor(engine).length, `${engine} has no capability entries`).toBeGreaterThan(0);
    }
  });

  it("represents Kling and Runway targets without claiming live access", () => {
    const kling = ENGINE_CAPABILITIES.find((item) => item.provider === "kling");
    const runway = ENGINE_CAPABILITIES.find((item) => item.provider === "runway");
    expect(kling?.state).toBe("disabled-paid");
    expect(runway?.state).toBe("disabled-paid");
    expect(kling?.functions).toContain("motion control");
    expect(runway?.functions).toContain("performance capture");
  });

  it("keeps paid remote services out of zero-cost provider lists", () => {
    for (const engine of ["persona", "cinema", "edit"] as const) {
      expect(zeroCostProviders(engine).some((item) => item.executionClass === "paid-remote")).toBe(false);
    }
    expect(paidProvidersAreDisabled()).toBe(true);
  });
});
