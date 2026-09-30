import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { SIGNIN_MARKER_COOKIE } from "@/lib/google-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  // Otherwise a logout within five minutes of signing in reads as a lost session.
  response.cookies.set(SIGNIN_MARKER_COOKIE, "", { sameSite: "none", secure: true, path: "/", maxAge: 0 });
  return response;
}
