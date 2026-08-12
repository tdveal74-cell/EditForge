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

const KV_KEY = "editforge:cuts";

// Vercel serverless has a read-only project dir; /tmp is the only writable path (ephemeral per instance).
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "editforge-data")
  : path.join(process.cwd(), ".data");
const CUTS_FILE = path.join(DATA_DIR, "cuts.json");

// Vercel KV / Upstash Redis REST credentials. Marketplace stores attach either
// KV_REST_API_* (Vercel KV naming) or UPSTASH_REDIS_REST_* — accept both.
function kvCreds(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export function storeBackend(): "kv" | "file" {
  return kvCreds() ? "kv" : "file";
}

async function kvCommand(cmd: string[]): Promise<unknown> {
  const creds = kvCreds();
  if (!creds) throw new Error("KV not configured");
  const res = await fetch(creds.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`KV command ${cmd[0]} failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`KV error: ${data.error}`);
  return data.result ?? null;
}

function seedCuts(): Cut[] {
  const now = new Date().toISOString();
  return [
    { id: "cut-01", title: "TSWS E01 cold open", status: "review", presetId: "tsws-feature", createdAt: now, updatedAt: now },
    { id: "cut-02", title: "Faceless — Authentic Human Teaching", status: "grade", presetId: "faceless-teach", createdAt: now, updatedAt: now },
    { id: "cut-03", title: "Shorts pack — week 32", status: "ingest", presetId: "tsws-short", createdAt: now, updatedAt: now },
  ];
}

async function readAll(): Promise<Cut[]> {
  if (kvCreds()) {
    const raw = (await kvCommand(["GET", KV_KEY])) as string | null;
    if (raw == null) {
      const seed = seedCuts();
      await kvCommand(["SET", KV_KEY, JSON.stringify(seed)]);
      return seed;
    }
    return JSON.parse(raw) as Cut[];
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(CUTS_FILE, "utf8");
    return JSON.parse(raw) as Cut[];
  } catch {
    const seed = seedCuts();
    await fs.writeFile(CUTS_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
}

async function writeAll(cuts: Cut[]): Promise<void> {
  if (kvCreds()) {
    await kvCommand(["SET", KV_KEY, JSON.stringify(cuts)]);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CUTS_FILE, JSON.stringify(cuts, null, 2));
}

export async function listCuts(): Promise<Cut[]> {
  return readAll();
}

export async function getCut(id: string): Promise<Cut | null> {
  const cuts = await readAll();
  return cuts.find((c) => c.id === id) ?? null;
}

export async function upsertCut(cut: Cut): Promise<Cut> {
  const cuts = await readAll();
  const i = cuts.findIndex((c) => c.id === cut.id);
  if (i >= 0) cuts[i] = cut;
  else cuts.unshift(cut);
  await writeAll(cuts);
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
