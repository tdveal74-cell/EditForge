import { NextResponse } from "next/server";
import { controlRequestAuthorized } from "@/lib/control-auth";
import { attachProductionAsset } from "@/lib/production-store";
import type { ProductionAsset, ProductionAssetKind } from "@/lib/production";

function createdAt(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return new Date().toISOString();
  return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric).toISOString();
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await controlRequestAuthorized(req))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const worker = body.asset ?? {};
    const asset: ProductionAsset = {
      id: String(worker.id ?? ""),
      kind: String(worker.kind ?? "") as ProductionAssetKind,
      label: String(worker.label ?? worker.filename ?? "asset"),
      mimeType: String(worker.mimeType ?? "application/octet-stream"),
      bytes: Number(worker.bytes ?? 0),
      sha256: String(worker.sha256 ?? ""),
      workerAssetId: String(worker.id ?? ""),
      consentId: worker.consentId ? String(worker.consentId) : undefined,
      createdAt: createdAt(worker.createdAt),
    };
    const project = await attachProductionAsset(id, String(body.requirementId ?? ""), asset);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ project, asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
