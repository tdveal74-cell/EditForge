import { NextResponse } from "next/server";
import { listCuts, upsertCut, type Cut } from "@/lib/store";

export async function GET() {
  const cuts = await listCuts();
  return NextResponse.json({ cuts });
}

export async function POST(req: Request) {
  const body = await req.json();
  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const cut: Cut = {
    id: `cut-${Date.now().toString(36)}`,
    title,
    status: "ingest",
    presetId: body.presetId || undefined,
    notes: body.notes || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await upsertCut(cut);
  return NextResponse.json({ cut }, { status: 201 });
}
