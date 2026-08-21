import { NextResponse } from "next/server";
import { controlRequestAuthorized } from "@/lib/control-auth";
import { registerProductionAsset } from "@/lib/production-store";
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
    const kind = String(worker.kind ?? "") as ProductionAssetKind;
    if (!(["video", "audio", "caption-track", "visual-reference"] as string[]).includes(kind)) {
      return NextResponse.json(
        { error: "Editorial media must be video, audio, caption-track, or visual-reference" },
        { status: 400 },
      );
    }
    const asset: ProductionAsset = {
      id: String(worker.id ?? ""),
      kind,
      label: String(worker.label ?? worker.filename ?? "editorial media"),
      mimeType: String(worker.mimeType ?? "application/octet-stream"),
      bytes: Number(worker.bytes ?? 0),
      sha256: String(worker.sha256 ?? ""),
      workerAssetId: String(worker.id ?? ""),
      consentId: worker.consentId ? String(worker.consentId) : undefined,
      createdAt: createdAt(worker.createdAt),
    };
    const project = await registerProductionAsset(id, asset);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ project, asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
