import { NextResponse } from "next/server";
import { setRubricPass } from "@/lib/store";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const pass = Boolean(body.pass);
  const cut = await setRubricPass(id, pass);
  if (!cut) {
    return NextResponse.json({ error: "cut not found" }, { status: 404 });
  }
  return NextResponse.json({ cut });
}
