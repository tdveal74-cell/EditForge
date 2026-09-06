import { NextResponse } from "next/server";
import { setRecoveryPassword, validateRecoveryPassword } from "@/lib/access-password";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = String(body.password || "");
  const error = validateRecoveryPassword(password);
  if (error) return NextResponse.json({ error }, { status: 400 });
  await setRecoveryPassword(password);
  return NextResponse.json({ ok: true });
}

