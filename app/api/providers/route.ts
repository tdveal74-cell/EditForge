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
    const billable =
      p.id !== "mock" && wired && credentialSet && rateConfigured && spendEnabled;

    let blockedReason: string | undefined;
    if (p.id !== "mock") {
      if (!wired) blockedReason = "Live adapter not implemented";
      else if (!credentialSet) blockedReason = `${p.envKey} is not configured`;
      else if (policy.mode === "zero-cost") blockedReason = "Paid providers are hard blocked by zero-cost mode";
      else if (!policy.billingEnabled) blockedReason = "Billing is disabled";
      else if (!rateConfigured) blockedReason = `${p.rateEnvKey} is not configured`;
      else if (!spendEnabled) blockedReason = "A positive total and per-job budget is required";
      else blockedReason = "Server cost preflight required before submission";
    }

    return {
      id: p.id,
      label: p.label,
      kind: p.kind,
      billable,
      wired,
      blockedReason,
      envKey: p.envKey || undefined,
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
