import { NextResponse } from "next/server";
import { PROVIDERS, credentialKeysFor, providerReadiness } from "@/lib/providers";
import { artifactStoreConfigured } from "@/lib/artifacts";

export const dynamic = "force-dynamic";

/**
 * What each provider can actually do right now, so a picker can warn before
 * money is spent rather than after.
 *
 * Reports the credential variable NAME and whether it is set — never the value.
 * Same rule as /api/health: enough to diagnose, nothing worth stealing.
 */
export async function GET() {
  const artifactStore = artifactStoreConfigured();

  const providers = PROVIDERS.map((p) => {
    // `wired` used to read `Boolean(p.endpoint)` while `isLiveWired` asked
    // whether the shape was implemented. The two disagreed, so the picker
    // called a provider ready that the boundary would refuse. One answer now,
    // computed in the registry and shared with the MCP status tool.
    const readiness = providerReadiness(p, { artifactStore });
    return {
      id: p.id,
      label: p.label,
      kind: p.kind,
      /** True when a run would reach a real provider and bill for it. */
      billable: readiness.ready,
      /** Whether the live path is implemented at all for this provider. */
      wired: readiness.wired,
      envKey: p.envKey || undefined,
      /** Every name this provider's credential may be set under. */
      envKeys: credentialKeysFor(p),
      credentialSet: p.envKey ? readiness.credentialSet : undefined,
      /** Further env this provider needs before a live run will be accepted. */
      settingsMissing: readiness.settingsMissing,
      requiresArtifactStore: Boolean(p.wire?.binary || p.wire?.jsonMedia) || undefined,
    };
  });

  return NextResponse.json({ providers, artifactStore });
}
