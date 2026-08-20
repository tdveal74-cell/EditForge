export type SpendMode = "zero-cost" | "controlled";

export type ExecutionClass =
  | "offline-plan"
  | "free-local"
  | "free-remote"
  | "paid-remote";

export type SpendPolicy = {
  mode: SpendMode;
  billingEnabled: boolean;
  totalBudgetUsd: number;
  spentUsd: number;
  perJobLimitUsd: number;
};

export type SpendRequest = {
  provider: string;
  executionClass: ExecutionClass;
  /** Paid work is refused when its cost cannot be bounded before submission. */
  estimatedCostUsd?: number;
};

export type SpendDecision =
  | {
      allowed: true;
      chargeable: boolean;
      remainingBudgetUsd: number;
      reason: string;
    }
  | {
      allowed: false;
      chargeable: boolean;
      remainingBudgetUsd: number;
      reason: string;
    };

function dollars(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Fail-closed defaults. Merely adding a provider API key never enables spend.
 */
export function spendPolicyFromEnv(
  env: Record<string, string | undefined> = process.env,
): SpendPolicy {
  const requestedMode = env.EDITFORGE_SPEND_MODE;
  const mode: SpendMode = requestedMode === "controlled" ? "controlled" : "zero-cost";

  return {
    mode,
    billingEnabled: env.EDITFORGE_BILLING_ENABLED === "true",
    totalBudgetUsd: dollars(env.EDITFORGE_TOTAL_BUDGET_USD, 0),
    spentUsd: dollars(env.EDITFORGE_SPENT_USD, 0),
    perJobLimitUsd: dollars(env.EDITFORGE_PER_JOB_LIMIT_USD, 0),
  };
}

export function evaluateSpend(
  policy: SpendPolicy,
  request: SpendRequest,
): SpendDecision {
  const remainingBudgetUsd = Math.max(0, policy.totalBudgetUsd - policy.spentUsd);

  if (request.executionClass !== "paid-remote") {
    return {
      allowed: true,
      chargeable: false,
      remainingBudgetUsd,
      reason:
        request.executionClass === "free-local"
          ? "Free software path approved; compute availability is evaluated separately"
          : "Non-billable execution approved",
    };
  }

  if (policy.mode === "zero-cost") {
    return {
      allowed: false,
      chargeable: true,
      remainingBudgetUsd,
      reason: `Paid provider ${request.provider} blocked by zero-cost mode`,
    };
  }

  if (!policy.billingEnabled) {
    return {
      allowed: false,
      chargeable: true,
      remainingBudgetUsd,
      reason: "Billing remains disabled; an API key alone cannot authorize spend",
    };
  }

  const estimate = request.estimatedCostUsd;
  if (estimate === undefined || !Number.isFinite(estimate) || estimate <= 0) {
    return {
      allowed: false,
      chargeable: true,
      remainingBudgetUsd,
      reason: "Paid work requires a finite preflight cost estimate",
    };
  }

  if (policy.perJobLimitUsd <= 0 || estimate > policy.perJobLimitUsd) {
    return {
      allowed: false,
      chargeable: true,
      remainingBudgetUsd,
      reason: `Estimated cost $${estimate.toFixed(2)} exceeds the per-job limit`,
    };
  }

  if (estimate > remainingBudgetUsd) {
    return {
      allowed: false,
      chargeable: true,
      remainingBudgetUsd,
      reason: `Estimated cost $${estimate.toFixed(2)} exceeds remaining budget`,
    };
  }

  return {
    allowed: true,
    chargeable: true,
    remainingBudgetUsd,
    reason: `Approved inside the $${policy.perJobLimitUsd.toFixed(2)} per-job ceiling`,
  };
}
