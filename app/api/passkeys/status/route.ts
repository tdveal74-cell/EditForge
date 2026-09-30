import { NextResponse } from "next/server";
import { listPasskeys } from "@/lib/passkeys";

export const dynamic = "force-dynamic";

export async function GET() {
  const passkeys = await listPasskeys();
  return NextResponse.json({ available: passkeys.length > 0, count: passkeys.length });
}

