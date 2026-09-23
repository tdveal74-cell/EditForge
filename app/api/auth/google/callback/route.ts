import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GOOGLE_STATE_COOKIE, SESSION_COOKIE, createGoogleSession, secretsMatch } from "@/lib/auth";

export const dynamic = "force-dynamic";
type TokenInfo = { aud?: string; email?: string; email_verified?: string; exp?: string; iss?: string };

function failure(req: Request, reason: string) {
  const publicOrigin = process.env.EDITFORGE_GOOGLE_REDIRECT_ORIGIN?.trim() || new URL(req.url).origin;
  const url = new URL("/login", publicOrigin);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const expectedState = (await cookies()).get(GOOGLE_STATE_COOKIE)?.value ?? "";
  if (!state || !expectedState || !secretsMatch(state, expectedState)) return failure(req, "state");
  const code = url.searchParams.get("code");
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const allowedEmail = process.env.EDITFORGE_GOOGLE_ALLOWED_EMAIL?.trim().toLowerCase();
  const origin = process.env.EDITFORGE_GOOGLE_REDIRECT_ORIGIN?.trim() || url.origin;
  if (!code || !clientId || !clientSecret || !allowedEmail) return failure(req, "configuration");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${origin.replace(/\/$/, "")}/api/auth/google/callback`, grant_type: "authorization_code" }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) return failure(req, "exchange");
  const idToken = ((await tokenResponse.json()) as { id_token?: string }).id_token;
  if (!idToken) return failure(req, "identity");
  const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, { cache: "no-store" });
  if (!verifyResponse.ok) return failure(req, "identity");
  const identity = (await verifyResponse.json()) as TokenInfo;
  const issuerOk = identity.iss === "accounts.google.com" || identity.iss === "https://accounts.google.com";
  if (!issuerOk || Number(identity.exp ?? 0) <= Math.floor(Date.now() / 1000) || identity.aud !== clientId || identity.email_verified !== "true" || identity.email?.toLowerCase() !== allowedEmail) {
    return failure(req, "account");
  }
  const returnTo = decodeURIComponent(state.split(".").slice(1).join(".") || "/presenter-broll");
  const destination = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/presenter-broll";
  // Behind the self-hosted Docker proxy, req.url can use the container's
  // 0.0.0.0 origin. Always return the browser to the configured public origin.
  const response = NextResponse.redirect(new URL(destination, origin));
  response.cookies.set(SESSION_COOKIE, await createGoogleSession(allowedEmail), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
