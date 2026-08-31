import { NextResponse } from "next/server";
import { probeStore, storeEnvPresent, storeFallbackReason } from "@/lib/store";
import { accessGateEnabled } from "@/lib/auth";
import { probeWorker } from "@/lib/edit-worker";
import { artifactStoreConfigured } from "@/lib/artifacts";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await probeStore();
  const worker = await probeWorker();
  const fallbackReason = storeFallbackReason();
  const healthy = store.reachable && (!worker.configured || worker.reachable);
  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      service: "editforge",
      version: "0.1.0",
      standard: "navy-amber-surface",
      store: store.backend,
      storeReachable: store.reachable,
      // Names only — credential values are never read out.
      storeEnv: storeEnvPresent(),
      // Whether the app-level gate is configured. A boolean, never the secret —
      // and it reveals nothing an unauthenticated caller cannot already tell by
      // requesting any other path and seeing whether it redirects.
      accessGate: accessGateEnabled(),
      executionReady: worker.configured && worker.reachable,
      // Providers that answer with the media itself (ElevenLabs TTS) need
      // somewhere to put it. Reported here so a voice submit that would refuse
      // is diagnosable before anyone spends money finding out.
      artifactStore: artifactStoreConfigured(),
      workerConfigured: worker.configured,
      workerReachable: worker.reachable,
      ...(worker.error ? { workerError: worker.error } : {}),
      ...(fallbackReason ? { storeFallbackReason: fallbackReason } : {}),
      ...(store.error ? { storeError: store.error } : {}),
    },
    { status: healthy ? 200 : 503 }
  );
}
