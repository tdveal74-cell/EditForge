import { NextResponse } from "next/server";
import { addStock, listStock } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ stock: await listStock() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await addStock({
    kind: String(body.kind || ""),
    title: String(body.title || ""),
    mood: body.mood ? String(body.mood) : undefined,
    durationSec: typeof body.durationSec === "number" ? body.durationSec : undefined,
    licenseNote: String(body.licenseNote || ""),
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ item: result.item }, { status: 201 });
}
