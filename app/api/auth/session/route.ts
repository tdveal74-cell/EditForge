import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readGoogleSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export async function GET() {
  const session = await readGoogleSession((await cookies()).get(SESSION_COOKIE)?.value ?? "");
  return NextResponse.json(session ? { authenticated: true, email: session.email } : { authenticated: false }, { headers: { "Cache-Control": "no-store" } });
}
