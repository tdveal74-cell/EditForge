import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { SESSION_COOKIE, secretsMatch, sessionToken } from "@/lib/auth";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  googleAuthConfig,
  googleAuthOrigin,
} from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function clearCeremonyCookies(response: NextResponse) {
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  response.cookies.set(GOOGLE_VERIFIER_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
}

export async function GET(req: NextRequest) {
  const config = googleAuthConfig();
  const fallbackOrigin = config?.origin || googleAuthOrigin();
  const fail = () => {
    const response = NextResponse.redirect(new URL("/login?auth=google-failed", fallbackOrigin));
    clearCeremonyCookies(response);
    return response;
  };
  if (!config) return fail();

  const code = req.nextUrl.searchParams.get("code") || "";
  const state = req.nextUrl.searchParams.get("state") || "";
  const expectedState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value || "";
  const verifier = req.cookies.get(GOOGLE_VERIFIER_COOKIE)?.value || "";
  if (!code || !state || !expectedState || !verifier || !secretsMatch(state, expectedState)) return fail();

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${config.origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) return fail();
    const tokens = (await tokenResponse.json()) as { id_token?: string };
    if (!tokens.id_token) return fail();

    const { payload } = await jwtVerify(tokens.id_token, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: config.clientId,
    });
    const email = String(payload.email || "").toLowerCase();
    if (payload.email_verified !== true || !config.allowedEmails.includes(email)) return fail();

    const response = NextResponse.redirect(new URL("/", config.origin));
    clearCeremonyCookies(response);
    response.cookies.set(SESSION_COOKIE, await sessionToken(), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch {
    return fail();
  }
}
