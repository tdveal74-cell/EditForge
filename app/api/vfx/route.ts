import { NextResponse } from "next/server";
import { addShot, listShots, setShotStatus } from "@/lib/vfxboard";
import { isShotStatus } from "@/lib/vfxShot";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ shots: await listShots() });
}

/** Add a shot to the board. Duplicate ids are refused — the id is the conform key. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await addShot({
    id: String(body.id || ""),
    desc: String(body.desc || ""),
    engine: String(body.engine || ""),
    cutId: body.cutId ? String(body.cutId) : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });
  return NextResponse.json({ shot: result.shot }, { status: 201 });
}

/** Move a shot's status. This is the thing a board exists to do. */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "").trim();
  const status = String(body.status || "");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!isShotStatus(status)) {
    return NextResponse.json({ error: `unknown status "${status}"` }, { status: 400 });
  }

  const shot = await setShotStatus(id, status, typeof body.note === "string" ? body.note : undefined);
  if (!shot) return NextResponse.json({ error: `no shot "${id}"` }, { status: 404 });
  return NextResponse.json({ shot });
}
