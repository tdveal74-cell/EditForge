import { NextResponse } from "next/server";
import { removePasskey } from "@/lib/passkeys";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const removed = await removePasskey(id);
  return removed
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Passkey not found." }, { status: 404 });
}

