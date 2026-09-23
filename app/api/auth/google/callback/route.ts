import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { SESSION_COOKIE, secretsMatch, sessionToken } from "@/lib/auth";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  googleAuthConfig,
  googleAuthOrigin,
  googleFailurePath,
  postSignInPath,
  sanitizeFailureDetail,
  type GoogleFailure,
} from "@/lib/google-auth";
import { listPasskeys } from "@/lib/passkeys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** A short machine code for a thrown error: jose's code, then Node's network cause. */
function failureCode(err: unknown): string {
  const e = err as { code?: string; name?: string; cause?: { code?: string } };
  return e?.code || e?.cause?.code || e?.name || "unknown";
}

function clearCeremonyCookies(response: NextResponse) {
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  response.cookies.set(GOOGLE_VERIFIER_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
}

export async function GET(req: NextRequest) {
  const config = googleAuthConfig();
  const fallbackOrigin = config?.origin || googleAuthOrigin();
  // One named reason per exit, logged and carried to the login page. Never a
  // token, code, secret or full email address.
  const fail = (reason: GoogleFailure, detail?: string | null) => {
    console.warn(
      JSON.stringify({ event: "google_signin_failed", reason, detail: sanitizeFailureDetail(detail) }),
    );
    const response = NextResponse.redirect(new URL(googleFailurePath(reason, detail), fallbackOrigin));
    clearCeremonyCookies(response);
    return response;
  };
  if (!config) return fail("not-configured");

  const googleError = req.nextUrl.searchParams.get("error");
  if (googleError) return fail("google-error", googleError);
  const code = req.nextUrl.searchParams.get("code") || "";
  const state = req.nextUrl.searchParams.get("state") || "";
  const expectedState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value || "";
  const verifier = req.cookies.get(GOOGLE_VERIFIER_COOKIE)?.value || "";
  if (!code) return fail("no-code");
  if (!expectedState || !verifier) {
    return fail("state-cookie", [!expectedState && "state", !verifier && "verifier"].filter(Boolean).join("+"));
  }
  if (!state || !secretsMatch(state, expectedState)) return fail("state-mismatch");

  try {
    let tokenResponse: Response;
    try {
      tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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
    } catch (err) {
      // The box could not reach Google at all: DNS, egress or a timeout.
      return fail("token-exchange", `network-${failureCode(err)}`);
    }
    if (!tokenResponse.ok) {
      // Google's error field is a fixed vocabulary (invalid_grant,
      // redirect_uri_mismatch, invalid_client); the description is not kept.
      const body = (await tokenResponse.json().catch(() => ({}))) as { error?: string };
      return fail("token-exchange", `${tokenResponse.status}-${body.error ?? "no-error-field"}`);
    }
    const tokens = (await tokenResponse.json()) as { id_token?: string };
    if (!tokens.id_token) return fail("no-id-token");

    let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
    try {
      ({ payload } = await jwtVerify(tokens.id_token, googleKeys, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: config.clientId,
      }));
    } catch (err) {
      return fail("id-token", failureCode(err));
    }
    const email = String(payload.email || "").toLowerCase();
    if (payload.email_verified !== true) return fail("email-unverified");
    // The domain alone says whether a different account was picked, without
    // putting anyone's address in a URL or a log.
    if (!config.allowedEmails.includes(email)) return fail("email-not-allowed", email.split("@")[1] || "no-email");

    // A store read failure must not strand a verified owner; fall back home.
    const passkeyCount = await listPasskeys().then((keys) => keys.length, () => 1);
    const response = NextResponse.redirect(new URL(postSignInPath(passkeyCount), config.origin));
    clearCeremonyCookies(response);
    response.cookies.set(SESSION_COOKIE, await sessionToken(), {
      httpOnly: true,
      // Lax, not strict: this response answers a navigation Google started,
      // and a strict cookie set here is not sent on the redirect that follows,
      // so the proxy bounced a verified owner back to /login with no message.
      // Measured in Chromium 141 on 2026-09-23. POSTs stay cross-site blocked.
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (err) {
    return fail("session", failureCode(err));
  }
}
