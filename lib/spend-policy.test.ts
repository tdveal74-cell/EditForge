import { describe, expect, it } from "vitest";
import { evaluateSpend, spendPolicyFromEnv } from "./spend-policy";

describe("spend policy", () => {
  it("defaults to zero-cost with a zero-dollar ceiling", () => {
    const policy = spendPolicyFromEnv({});
    expect(policy.mode).toBe("zero-cost");
    expect(policy.billingEnabled).toBe(false);
    expect(policy.totalBudgetUsd).toBe(0);
    expect(policy.perJobLimitUsd).toBe(0);
  });

  it("does not let an API key silently enable paid work", () => {
    const policy = spendPolicyFromEnv({ RUNWAY_API_KEY: "present-but-irrelevant" });
    const result = evaluateSpend(policy, {
      provider: "runway",
      executionClass: "paid-remote",
      estimatedCostUsd: 0.5,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/zero-cost mode/i);
  });

  it("keeps free local tools usable in zero-cost mode", () => {
    const result = evaluateSpend(spendPolicyFromEnv({}), {
      provider: "ffmpeg",
      executionClass: "free-local",
    });
    expect(result.allowed).toBe(true);
    expect(result.chargeable).toBe(false);
  });

  it("requires explicit billing, an estimate and limits in controlled mode", () => {
    const policy = spendPolicyFromEnv({
      EDITFORGE_SPEND_MODE: "controlled",
      EDITFORGE_BILLING_ENABLED: "true",
      EDITFORGE_TOTAL_BUDGET_USD: "10",
      EDITFORGE_SPENT_USD: "2",
      EDITFORGE_PER_JOB_LIMIT_USD: "1",
    });

    expect(evaluateSpend(policy, { provider: "kling", executionClass: "paid-remote" }).allowed).toBe(false);
    expect(evaluateSpend(policy, { provider: "kling", executionClass: "paid-remote", estimatedCostUsd: 0 }).allowed).toBe(false);
    expect(evaluateSpend(policy, { provider: "kling", executionClass: "paid-remote", estimatedCostUsd: 1.25 }).allowed).toBe(false);
    expect(evaluateSpend(policy, { provider: "kling", executionClass: "paid-remote", estimatedCostUsd: 0.75 }).allowed).toBe(true);
  });
});
