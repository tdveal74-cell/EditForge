import { NextResponse } from "next/server";
import { listRolls, reviewRoll, selectForCut } from "@/lib/dailies";
import { getCut } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ rolls: await listRolls() });
}

/**
 * Two actions, both recording a decision rather than accepting one.
 *
 *   review  — approve or reject a roll, with an optional reason
 *   select  — put an approved roll into a cut
 *
 * "Nothing enters the cut unreviewed" is enforced in `selectForCut`, which reads
 * the recorded status. Sending `status: "approved"` here does nothing: there is
 * no field on this route that lets a caller assert its own approval.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const id = String(body.id || "").trim();

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (action === "review") {
    const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : null;
    if (!decision) {
      return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 });
    }
    const roll = await reviewRoll(id, decision, typeof body.note === "string" ? body.note : undefined);
    if (!roll) return NextResponse.json({ error: `no roll "${id}"` }, { status: 404 });
    return NextResponse.json({ roll });
  }

  if (action === "select") {
    const cutId = String(body.cutId || "").trim();
    if (!cutId) return NextResponse.json({ error: "cutId required" }, { status: 400 });

    // Selecting into a cut that does not exist would file the roll against
    // nothing and read as success.
    if (!(await getCut(cutId))) {
      return NextResponse.json({ error: `no cut "${cutId}"` }, { status: 404 });
    }

    const result = await selectForCut(id, cutId);
    if (!result.ok) {
      // 409, not 403: the roll exists and the caller may act on it — the
      // conflict is with its current state, which a review can change.
      return NextResponse.json({ error: result.reason, status: result.status }, { status: 409 });
    }
    return NextResponse.json({ roll: result.roll });
  }

  return NextResponse.json({ error: 'action must be "review" or "select"' }, { status: 400 });
}
