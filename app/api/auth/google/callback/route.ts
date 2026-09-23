import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { SESSION_COOKIE, secretsMatch, sessionToken } from "@/lib/auth";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  SIGNIN_MARKER_COOKIE,
  emailDomain,
  googleAuthConfig,
  googleAuthOrigin,
  googleErrorCode,
  googleFailurePath,
  postSignInPath,
  sanitizeFailureDetail,
  tokenErrorCode,
  type GoogleFailure,
} from "@/lib/google-auth";
import { listPasskeys } from "@/lib/passkeys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/**
 * A short machine code for a thrown error: jose's code (with the claim that
 * failed, so a clock running behind reads as -nbf), then Node's network cause.
 */
function failureCode(err: unknown): string {
  const e = err as { code?: string; name?: string; claim?: string; cause?: { code?: string } };
  const code = e?.code || e?.cause?.code || e?.name || "unknown";
  return typeof e?.claim === "string" ? `${code}-${e.claim}` : code;
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
  if (googleError) return fail("google-error", googleErrorCode(googleError));
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
      // Only a known error code is kept; anything else is "other", and the
      // description is never read.
      const body = (await tokenResponse.json().catch(() => null)) as { error?: unknown } | null;
      return fail("token-exchange", `${tokenResponse.status}-${tokenErrorCode(body?.error)}`);
    }
    let tokens: unknown;
    try {
      tokens = await tokenResponse.json();
    } catch {
      // A 200 that is not JSON came from something between the box and Google.
      return fail("token-exchange", `${tokenResponse.status}-unparseable`);
    }
    const idToken = (tokens as { id_token?: unknown } | null)?.id_token;
    if (typeof idToken !== "string" || !idToken) return fail("no-id-token");

    let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
    try {
      ({ payload } = await jwtVerify(idToken, googleKeys, {
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
    if (!config.allowedEmails.includes(email)) return fail("email-not-allowed", emailDomain(email) || "no-email");

    // A store read failure must not strand a verified owner; fall back home.
    const passkeyCount = await Promise.resolve()
      .then(listPasskeys)
      .then((keys) => keys.length, () => 1);
    const landing = postSignInPath(passkeyCount);
    const response = NextResponse.redirect(new URL(landing, config.origin));
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
    // No secret in it. It lets the proxy name a session that did not come back
    // on the next request instead of showing a blank login page.
    response.cookies.set(SIGNIN_MARKER_COOKIE, "1", { sameSite: "none", secure: true, path: "/", maxAge: 5 * 60 });
    console.info(JSON.stringify({ event: "google_signin_succeeded", landing: landing.split("?")[0] }));
    return response;
  } catch (err) {
    return fail("session", failureCode(err));
  }
}
