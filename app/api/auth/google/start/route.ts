import { NextResponse } from "next/server";
import { GOOGLE_STATE_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/presenter-broll";
}

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 503 });
  const requestUrl = new URL(req.url);
  const origin = process.env.EDITFORGE_GOOGLE_REDIRECT_ORIGIN?.trim() || requestUrl.origin;
  const redirectUri = `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
  const state = `${crypto.randomUUID()}.${encodeURIComponent(safeReturnTo(requestUrl.searchParams.get("returnTo")))}`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");
  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return response;
}
