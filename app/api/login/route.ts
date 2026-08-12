import { NextResponse } from "next/server";
import { SESSION_COOKIE, secretsMatch, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Exchange the access password for a session cookie. */
export async function POST(req: Request) {
  const password = process.env.EDITFORGE_ACCESS_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "No access password is configured, so there is nothing to sign in to." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const provided = String(body.password ?? "");
  if (!provided || !secretsMatch(provided, password)) {
    // One message for both wrong and empty: nothing here should help someone
    // work out how close they got.
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
