import type { Metadata } from "next";
import { ProductionStudio } from "@/components/AscensionStudio";
import { getForgeWorkerHealth, type ForgeWorkerHealth } from "@/lib/forge-worker";
import { ensureTswsMicrodrama } from "@/lib/production-store";

export const metadata: Metadata = {
  title: "TSWS Microdrama production",
  description: "Creator-authoritative TSWS Microdrama intake and 4K mastering with long-form protection.",
};

export const dynamic = "force-dynamic";

export default async function TswsMicrodramaPage() {
  const [project, workerState] = await Promise.all([
    ensureTswsMicrodrama(),
    getForgeWorkerHealth()
      .then((worker): { worker: ForgeWorkerHealth | null; workerError: string | null } => ({ worker, workerError: null }))
      .catch((error): { worker: ForgeWorkerHealth | null; workerError: string | null } => ({ worker: null, workerError: (error as Error).message })),
  ]);
  return <ProductionStudio initialProject={project} initialWorker={workerState.worker} initialWorkerError={workerState.workerError} />;
}
