export type GoogleAuthConfig = {
  clientId: string;
  clientSecret: string;
  allowedEmails: string[];
  origin: string;
};

export const GOOGLE_STATE_COOKIE = "editforge_google_state";
export const GOOGLE_VERIFIER_COOKIE = "editforge_google_verifier";

export function googleAuthOrigin(): string {
  return (
    process.env.EDITFORGE_GOOGLE_REDIRECT_ORIGIN?.trim() ||
    process.env.EDITFORGE_PASSKEY_ORIGIN?.trim() ||
    (process.env.NODE_ENV === "production" ? "https://editforge.online" : "http://localhost:3000")
  );
}

export function googleAuthConfig(): GoogleAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  const allowedEmails = (process.env.EDITFORGE_GOOGLE_ALLOWED_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const origin = googleAuthOrigin();
  if (!clientId || !clientSecret || allowedEmails.length === 0) return null;
  return { clientId, clientSecret, allowedEmails, origin };
}

/**
 * Where a fresh Google sign-in lands. Google is the recovery door; the passkey
 * is the everyday one. Until a passkey exists, send the owner straight to
 * enrollment instead of leaving it three menus deep under Departments.
 */
export function postSignInPath(passkeyCount: number): string {
  return passkeyCount > 0 ? "/" : "/security?welcome=1";
}

/**
 * Every way a Google sign-in can fail. Each one used to land on the same
 * "could not be verified" line with nothing logged, so a failed sign-in on the
 * live studio could not be told apart from any other. The reason travels in
 * the redirect and in the server log; neither ever carries a token, a code, a
 * secret or a full email address. The last two are raised by the proxy, after
 * a callback that succeeded, when the session did not come back with the next
 * request.
 */
export type GoogleFailure =
  | "not-configured"
  | "google-error"
  | "no-code"
  | "state-cookie"
  | "state-mismatch"
  | "token-exchange"
  | "no-id-token"
  | "id-token"
  | "email-unverified"
  | "email-not-allowed"
  | "session"
  | "session-not-sent"
  | "session-invalid";

/**
 * Set by a successful callback with no secret in it, so the proxy can tell a
 * browser that just signed in from one that never did. SameSite=None on
 * purpose: it has to arrive on the very hop where a Lax session cookie might
 * not.
 */
export const SIGNIN_MARKER_COOKIE = "editforge_signin_marker";

// Authorization errors Google can return to the callback (RFC 6749 4.1.2.1,
// OpenID Connect Core 3.1.2.6, and Google's own). Anything else is "other", so
// a crafted ?error= cannot put its own words on the page or in the log.
const GOOGLE_ERROR_CODES = new Set([
  "access_denied",
  "invalid_request",
  "unauthorized_client",
  "unsupported_response_type",
  "invalid_scope",
  "server_error",
  "temporarily_unavailable",
  "interaction_required",
  "login_required",
  "account_selection_required",
  "consent_required",
  "admin_policy_enforced",
  "org_internal",
  "disallowed_useragent",
]);

// Token endpoint errors (RFC 6749 5.2), plus redirect_uri_mismatch, which
// Google returns there when the exchange names a different callback.
const TOKEN_ERROR_CODES = new Set([
  "redirect_uri_mismatch",
  "invalid_request",
  "invalid_client",
  "invalid_grant",
  "unauthorized_client",
  "unsupported_grant_type",
  "invalid_scope",
]);

export function googleErrorCode(value: unknown): string {
  return typeof value === "string" && GOOGLE_ERROR_CODES.has(value) ? value : "other";
}

export function tokenErrorCode(value: unknown): string {
  if (value === undefined || value === null) return "no-error-field";
  return typeof value === "string" && TOKEN_ERROR_CODES.has(value) ? value : "other";
}

/** The part after the last @, which is the domain even for a quoted local part. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "";
}

/** Keep only a short run of safe characters: enough to diagnose, nothing to steal. */
export function sanitizeFailureDetail(detail: string | null | undefined): string {
  return String(detail ?? "")
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function googleFailurePath(reason: GoogleFailure, detail?: string | null): string {
  const params = new URLSearchParams({ auth: "google-failed", reason });
  const safe = sanitizeFailureDetail(detail);
  if (safe) params.set("detail", safe);
  return `/login?${params.toString()}`;
}

const FAILURE_MESSAGES: Record<GoogleFailure, string> = {
  "not-configured": "Google sign-in is missing part of its configuration on the studio.",
  "google-error": "Google did not complete the sign-in.",
  "no-code": "Google came back without a sign-in code. Try again from this page.",
  "state-cookie":
    "This browser did not keep the sign-in check between leaving for Google and coming back. Try again from this page in the same tab, with private browsing off.",
  "state-mismatch": "The sign-in check did not match. Start again from this page.",
  "token-exchange": "The studio could not finish the sign-in with Google.",
  "no-id-token": "Google finished but sent no identity.",
  "id-token": "The studio could not verify Google's identity token.",
  "email-unverified": "That Google account's email is not verified.",
  "email-not-allowed": "That Google account is not the studio owner's. Choose the owner account.",
  session: "The studio could not start a session after Google verified you.",
  "session-not-sent":
    "Google verified you, but this browser did not send the studio's session back on the next page.",
  "session-invalid": "Google verified you, but the studio did not accept the session it had just issued.",
};

// What a detail may look like for each reason. The login page reads these
// from its own URL, so anything that does not fit is dropped rather than shown.
// A thrown error is shown only in the shapes real ones take: a jose code
// (ERR_...), a Node or undici network code (ECONNRESET, UND_ERR_...), an
// error class name, with the jose claim that failed. The domain of a
// disallowed account stays in the redirect and the log, never on the page,
// because a crafted link could otherwise show any domain-shaped text.
const CODE =
  /^(ERR_[A-Z0-9_]{3,40}|E[A-Z]{3,20}|UND_ERR_[A-Z_]{1,30}|[A-Z][A-Za-z]{0,30}Error|Error|unknown)(-(iss|aud|exp|nbf|iat|sub))?$/;
const DETAIL_PATTERNS: Partial<Record<GoogleFailure, RegExp>> = {
  "google-error": new RegExp(`^(${[...GOOGLE_ERROR_CODES, "other"].join("|")})$`),
  "state-cookie": /^(state|verifier|state-verifier)$/,
  "token-exchange": new RegExp(
    `^([1-5][0-9]{2}-(${[...TOKEN_ERROR_CODES, "other", "no-error-field", "unparseable"].join("|")})|network-[A-Za-z0-9_]{1,40})$`,
  ),
  "id-token": CODE,
  session: CODE,
};

/** The line the login page shows for ?auth=google-failed, with the reason code appended. */
export function googleFailureMessage(reason: string | null, detail: string | null): string {
  const known = reason && Object.hasOwn(FAILURE_MESSAGES, reason) ? (reason as GoogleFailure) : null;
  if (!known) return "Google sign-in could not be verified for this studio.";
  const pattern = DETAIL_PATTERNS[known];
  const fits = Boolean(detail && pattern && pattern.test(detail));
  return `${FAILURE_MESSAGES[known]} (${fits ? `${known} / ${detail}` : known})`;
}
