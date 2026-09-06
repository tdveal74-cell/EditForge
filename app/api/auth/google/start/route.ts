import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  googleAuthConfig,
  googleAuthOrigin,
} from "@/lib/google-auth";
import { sessionSecretConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const config = googleAuthConfig();
  if (!config || !sessionSecretConfigured()) {
    return NextResponse.redirect(new URL("/login?auth=google-unavailable", googleAuthOrigin()));
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = `${config.origin}/api/auth/google/callback`;
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(authorization);
  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/google",
    maxAge: 10 * 60,
  };
  response.cookies.set(GOOGLE_STATE_COOKIE, state, cookie);
  response.cookies.set(GOOGLE_VERIFIER_COOKIE, verifier, cookie);
  return response;
}
