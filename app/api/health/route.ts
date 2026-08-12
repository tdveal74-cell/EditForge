import { NextResponse } from "next/server";
import { probeStore, storeEnvPresent, storeFallbackReason } from "@/lib/store";
import { accessGateEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await probeStore();
  const fallbackReason = storeFallbackReason();
  return NextResponse.json(
    {
      status: store.reachable ? "healthy" : "degraded",
      service: "editforge",
      version: "0.1.0",
      standard: "ultra-meta-supreme-flagship-aaa",
      store: store.backend,
      storeReachable: store.reachable,
      // Names only — credential values are never read out.
      storeEnv: storeEnvPresent(),
      // Whether the app-level gate is configured. A boolean, never the secret —
      // and it reveals nothing an unauthenticated caller cannot already tell by
      // requesting any other path and seeing whether it redirects.
      accessGate: accessGateEnabled(),
      ...(fallbackReason ? { storeFallbackReason: fallbackReason } : {}),
      ...(store.error ? { storeError: store.error } : {}),
    },
    { status: store.reachable ? 200 : 503 }
  );
}
