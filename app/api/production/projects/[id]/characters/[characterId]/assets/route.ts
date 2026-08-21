import { NextResponse } from "next/server";
import { controlRequestAuthorized } from "@/lib/control-auth";
import { attachCharacterMedia, type CharacterMediaRole } from "@/lib/production-store";
import type { ProductionAsset, ProductionAssetKind } from "@/lib/production";

const ROLES = new Set<CharacterMediaRole>(["identity", "voice", "driving", "consent"]);

function createdAt(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return new Date().toISOString();
  return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric).toISOString();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; characterId: string }> },
) {
  if (!(await controlRequestAuthorized(req))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const { id, characterId } = await params;
    const body = await req.json();
    const role = String(body.role ?? "") as CharacterMediaRole;
    if (!ROLES.has(role)) return NextResponse.json({ error: "Unknown character media role" }, { status: 400 });
    const worker = body.asset ?? {};
    const asset: ProductionAsset = {
      id: String(worker.id ?? ""),
      kind: String(worker.kind ?? "") as ProductionAssetKind,
      label: String(worker.label ?? worker.filename ?? `${characterId} ${role}`),
      mimeType: String(worker.mimeType ?? "application/octet-stream"),
      bytes: Number(worker.bytes ?? 0),
      sha256: String(worker.sha256 ?? ""),
      workerAssetId: String(worker.id ?? ""),
      consentId: worker.consentId ? String(worker.consentId) : undefined,
      createdAt: createdAt(worker.createdAt),
    };
    const project = await attachCharacterMedia(id, characterId, role, asset);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ project, asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
