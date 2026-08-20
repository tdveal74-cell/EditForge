import { NextResponse } from "next/server";
import { ENGINE_CAPABILITIES } from "@/lib/engine-capabilities";
import { spendPolicyFromEnv } from "@/lib/spend-policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const policy = spendPolicyFromEnv();
  return NextResponse.json({
    mode: policy.mode,
    billingEnabled: policy.billingEnabled,
    totalBudgetUsd: policy.totalBudgetUsd,
    remainingBudgetUsd: Math.max(0, policy.totalBudgetUsd - policy.spentUsd),
    engines: ["persona", "cinema", "edit"],
    capabilities: ENGINE_CAPABILITIES,
  });
}

