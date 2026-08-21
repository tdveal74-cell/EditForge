import type { Metadata } from "next";
import { AscensionStudio } from "@/components/AscensionStudio";
import { ensureAscensionThreadOne } from "@/lib/production-store";
import { getForgeWorkerHealth, type ForgeWorkerHealth } from "@/lib/forge-worker";

export const metadata: Metadata = {
  title: "Ascension Caudex production",
  description: "Consent-gated full-motion production and 4K mastering for Ascension Caudex.",
};

export const dynamic = "force-dynamic";

export default async function AscensionPage() {
  const [project, workerState] = await Promise.all([
    ensureAscensionThreadOne(),
    getForgeWorkerHealth()
      .then((worker): { worker: ForgeWorkerHealth | null; workerError: string | null } => ({ worker, workerError: null }))
      .catch((error): { worker: ForgeWorkerHealth | null; workerError: string | null } => ({ worker: null, workerError: (error as Error).message })),
  ]);
  return <AscensionStudio initialProject={project} initialWorker={workerState.worker} initialWorkerError={workerState.workerError} />;
}
