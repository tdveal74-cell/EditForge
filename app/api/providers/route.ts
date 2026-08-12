import { NextResponse } from "next/server";
import { PROVIDERS, hasCredentials } from "@/lib/providers";

export const dynamic = "force-dynamic";

/**
 * What each provider can actually do right now, so a picker can warn before
 * money is spent rather than after.
 *
 * Reports the credential variable NAME and whether it is set — never the value.
 * Same rule as /api/health: enough to diagnose, nothing worth stealing.
 */
export async function GET() {
  const providers = PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    kind: p.kind,
    /** True when a run would reach a real provider and bill for it. */
    billable: p.id !== "mock" && hasCredentials(p.id) && Boolean(p.endpoint),
    /** Whether the live path is implemented at all for this provider. */
    wired: p.id === "mock" || Boolean(p.endpoint),
    envKey: p.envKey || undefined,
    credentialSet: p.envKey ? hasCredentials(p.id) : undefined,
  }));

  return NextResponse.json({ providers });
}
