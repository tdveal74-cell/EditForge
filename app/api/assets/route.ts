import { NextResponse } from "next/server";
import { addAsset, listAssets } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ assets: await listAssets() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await addAsset({
    name: String(body.name || ""),
    type: String(body.type || ""),
    tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    location: body.location ? String(body.location) : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ asset: result.item }, { status: 201 });
}
