import { NextResponse } from "next/server";
import { listPasskeys } from "@/lib/passkeys";

export const dynamic = "force-dynamic";

export async function GET() {
  const passkeys = await listPasskeys();
  return NextResponse.json({
    passkeys: passkeys.map(({ id, label, createdAt, lastUsedAt, backedUp }) => ({
      id,
      label,
      createdAt,
      lastUsedAt,
      backedUp,
    })),
  });
}

