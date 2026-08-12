import { promises as fs } from "fs";
import path from "path";

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

// Vercel serverless has a read-only project dir; /tmp is the only writable path (ephemeral per instance).
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "editforge-data")
  : path.join(process.cwd(), ".data");
const CUTS_FILE = path.join(DATA_DIR, "cuts.json");

async function ensure() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(CUTS_FILE);
  } catch {
    const seed: Cut[] = [
      {
        id: "cut-01",
        title: "TSWS E01 cold open",
        status: "review",
        presetId: "tsws-feature",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "cut-02",
        title: "Faceless — Authentic Human Teaching",
        status: "grade",
        presetId: "faceless-teach",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "cut-03",
        title: "Shorts pack — week 32",
        status: "ingest",
        presetId: "tsws-short",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await fs.writeFile(CUTS_FILE, JSON.stringify(seed, null, 2));
  }
}

export async function listCuts(): Promise<Cut[]> {
  await ensure();
  const raw = await fs.readFile(CUTS_FILE, "utf8");
  return JSON.parse(raw) as Cut[];
}

export async function getCut(id: string): Promise<Cut | null> {
  const cuts = await listCuts();
  return cuts.find((c) => c.id === id) ?? null;
}

export async function upsertCut(cut: Cut): Promise<Cut> {
  await ensure();
  const cuts = await listCuts();
  const i = cuts.findIndex((c) => c.id === cut.id);
  if (i >= 0) cuts[i] = cut;
  else cuts.unshift(cut);
  await fs.writeFile(CUTS_FILE, JSON.stringify(cuts, null, 2));
  return cut;
}

export async function setRubricPass(id: string, pass: boolean): Promise<Cut | null> {
  const cut = await getCut(id);
  if (!cut) return null;
  cut.rubricPass = pass;
  cut.status = pass ? "review" : "grade";
  cut.updatedAt = new Date().toISOString();
  return upsertCut(cut);
}
