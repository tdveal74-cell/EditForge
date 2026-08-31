import { NextResponse } from "next/server";
import { getTitleCards, saveTitleCards } from "@/lib/titlestore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ cards: await getTitleCards() });
}

/** Replace the stored cards. The motion preview hydrates this copy. */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await saveTitleCards((body as { cards?: unknown }).cards);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ cards: result.cards });
}
