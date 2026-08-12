import { NextResponse } from "next/server";
import { probeStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await probeStore();
  return NextResponse.json(
    {
      status: store.reachable ? "healthy" : "degraded",
      service: "editforge",
      version: "0.1.0",
      standard: "ultra-meta-supreme-flagship-aaa",
      store: store.backend,
      storeReachable: store.reachable,
      ...(store.error ? { storeError: store.error } : {}),
    },
    { status: store.reachable ? 200 : 503 }
  );
}
