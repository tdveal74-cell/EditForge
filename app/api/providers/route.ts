import { NextResponse } from "next/server";
import { PROVIDERS, hasCredentials, isLiveWired } from "@/lib/providers";
import { spendPolicyFromEnv } from "@/lib/spend-policy";

export const dynamic = "force-dynamic";

/**
 * What each provider can actually do right now, so a picker can warn before
 * money is spent rather than after.
 *
 * Reports the credential variable NAME and whether it is set — never the value.
 * Same rule as /api/health: enough to diagnose, nothing worth stealing.
 */
export async function GET() {
  const policy = spendPolicyFromEnv();
  const spendEnabled =
    policy.mode === "controlled" &&
    policy.billingEnabled &&
    policy.totalBudgetUsd > policy.spentUsd &&
    policy.perJobLimitUsd > 0;

  const providers = PROVIDERS.map((p) => {
    const wired = isLiveWired(p.id);
    const credentialSet = p.envKey ? hasCredentials(p.id) : true;
    const configuredRate = p.rateEnvKey ? Number(process.env[p.rateEnvKey]) : undefined;
    const rateConfigured = p.rateEnvKey
      ? Number.isFinite(configuredRate) && Number(configuredRate) > 0
      : true;
    const chargeable = p.executionClass === "paid-remote";
    const available =
      wired &&
      credentialSet &&
      (p.id === "mock" || !chargeable || (rateConfigured && spendEnabled));
    const billable = chargeable && available;

    let blockedReason: string | undefined;
    if (p.id !== "mock") {
      if (!wired) {
        blockedReason = p.endpointEnvKey && !process.env[p.endpointEnvKey]
          ? `${p.endpointEnvKey} is not configured`
          : "Live adapter not implemented";
      }
      else if (!credentialSet) blockedReason = `${p.envKey} is not configured`;
      else if (chargeable && policy.mode === "zero-cost") blockedReason = "Paid providers are hard blocked by zero-cost mode";
      else if (chargeable && !policy.billingEnabled) blockedReason = "Billing is disabled";
      else if (chargeable && !rateConfigured) blockedReason = `${p.rateEnvKey} is not configured`;
      else if (chargeable && !spendEnabled) blockedReason = "A positive total and per-job budget is required";
      else if (chargeable) blockedReason = "Server cost preflight required before submission";
    }

    return {
      id: p.id,
      label: p.label,
      kind: p.kind,
      kinds: p.kinds,
      executionClass: p.executionClass,
      available,
      billable,
      wired,
      blockedReason,
      envKey: p.envKey || undefined,
      endpointEnvKey: p.endpointEnvKey,
      credentialSet: p.envKey ? credentialSet : undefined,
      rateEnvKey: p.rateEnvKey,
      rateConfigured: p.rateEnvKey ? rateConfigured : undefined,
    };
  });

  return NextResponse.json({
    spendPolicy: {
      mode: policy.mode,
      billingEnabled: policy.billingEnabled,
      totalBudgetUsd: policy.totalBudgetUsd,
      remainingBudgetUsd: Math.max(0, policy.totalBudgetUsd - policy.spentUsd),
      perJobLimitUsd: policy.perJobLimitUsd,
    },
    providers,
  });
}
