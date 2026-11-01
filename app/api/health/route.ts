import { NextResponse } from "next/server";
import { probeStore, storeEnvPresent, storeFallbackReason } from "@/lib/store";
import { accessGateEnabled, sessionSecretConfigured } from "@/lib/auth";
import { probeWorker } from "@/lib/edit-worker";
import { artifactStoreConfigured } from "@/lib/artifacts";

export const dynamic = "force-dynamic";

export async function GET() {
  // The store and the worker answer to different services; probing them in
  // parallel halves the latency of the endpoint dashboards poll most often.
  const [store, worker] = await Promise.all([probeStore(), probeWorker()]);
  const fallbackReason = storeFallbackReason();
  const accessGate = accessGateEnabled();
  const sessionSecret = sessionSecretConfigured();
  const artifactStore = artifactStoreConfigured();
  const executionReady = worker.configured && worker.reachable;
  const productionReady = accessGate && sessionSecret && artifactStore && executionReady;
  const healthy = store.reachable && (process.env.NODE_ENV !== "production" || productionReady);
  const includeDiagnostics = process.env.NODE_ENV !== "production";
  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      service: "editforge",
      version: "1.0.0",
      store: store.backend,
      storeReachable: store.reachable,
      // Names only — credential values are never read out.
      storeEnv: storeEnvPresent(),
      // Whether the app-level gate is configured. A boolean, never the secret —
      // and it reveals nothing an unauthenticated caller cannot already tell by
      // requesting any other path and seeing whether it redirects.
      accessGate,
      sessionSecret,
      productionReady,
      executionReady,
      // Providers that answer with the media itself (ElevenLabs TTS) need
      // somewhere to put it. Reported here so a voice submit that would refuse
      // is diagnosable before anyone spends money finding out.
      artifactStore,
      workerConfigured: worker.configured,
      workerReachable: worker.reachable,
      ...(includeDiagnostics && worker.error ? { workerError: worker.error } : {}),
      ...(fallbackReason ? { storeFallbackReason: fallbackReason } : {}),
      ...(includeDiagnostics && store.error ? { storeError: store.error } : {}),
    },
    { status: healthy ? 200 : 503 }
  );
}
