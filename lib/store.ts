import { durableCollection } from "./durable";

export type CutStatus = "ingest" | "grade" | "review" | "shipped" | "archived";

export type Cut = {
  id: string;
  title: string;
  status: CutStatus;
  presetId?: string;
  rubricPass?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// Backend selection, credential diagnostics, and the liveness probe are shared
// with every other store — re-exported here so callers have one import.
export {
  storeBackend,
  storeEnvPresent,
  storeFallbackReason,
  probeStore,
} from "./durable";

function seedCuts(): Cut[] {
  const now = new Date().toISOString();
  return [
    { id: "cut-01", title: "TSWS E01 cold open", status: "review", presetId: "tsws-feature", createdAt: now, updatedAt: now },
    { id: "cut-02", title: "Faceless — Authentic Human Teaching", status: "grade", presetId: "faceless-teach", createdAt: now, updatedAt: now },
    { id: "cut-03", title: "Shorts pack — week 32", status: "ingest", presetId: "tsws-short", createdAt: now, updatedAt: now },
  ];
}

const cuts = durableCollection<Cut>({
  key: "editforge:cuts",
  file: "cuts.json",
  seed: seedCuts,
});

export async function listCuts(): Promise<Cut[]> {
  return cuts.list();
}

export async function getCut(id: string): Promise<Cut | null> {
  return cuts.get(id);
}

export async function upsertCut(cut: Cut): Promise<Cut> {
  await cuts.mutate((all) => {
    const i = all.findIndex((c) => c.id === cut.id);
    if (i >= 0) all[i] = cut;
    else all.unshift(cut);
  });
  return cut;
}

export async function setRubricPass(id: string, pass: boolean): Promise<Cut | null> {
  let updated: Cut | null = null;
  await cuts.mutate((all) => {
    const cut = all.find((c) => c.id === id);
    if (!cut) return;
    cut.rubricPass = pass;
    cut.status = pass ? "review" : "grade";
    cut.updatedAt = new Date().toISOString();
    updated = cut;
  });
  return updated;
}
