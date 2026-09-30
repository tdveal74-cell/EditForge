import { describe, expect, it } from "vitest";
import { decideSpendClick } from "./billable-confirmation";

const KEY = "gen-video-aaaaaaaa";
const OTHER = "gen-video-bbbbbbbb";

describe("decideSpendClick", () => {
  it("first click on a ready billable provider only confirms the exact key", () => {
    expect(
      decideSpendClick({
        billable: true,
        readinessKnown: true,
        currentKey: KEY,
        confirmedKey: null,
      }),
    ).toBe("confirm");
  });

  it("submits only when the armed confirmation matches the current key", () => {
    expect(
      decideSpendClick({
        billable: true,
        readinessKnown: true,
        currentKey: KEY,
        confirmedKey: KEY,
      }),
    ).toBe("submit");
  });

  it("invalidates a stale confirmation when the brief (and key) change", () => {
    expect(
      decideSpendClick({
        billable: true,
        readinessKnown: true,
        currentKey: OTHER,
        confirmedKey: KEY,
      }),
    ).toBe("confirm");
  });

  it("lets non-billable work run in one click even before readiness is known", () => {
    expect(
      decideSpendClick({
        billable: false,
        readinessKnown: false,
        currentKey: KEY,
        confirmedKey: null,
      }),
    ).toBe("submit");
  });
});
