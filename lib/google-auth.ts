export type GoogleAuthConfig = {
  clientId: string;
  clientSecret: string;
  allowedEmails: string[];
  origin: string;
};

export const GOOGLE_STATE_COOKIE = "editforge_google_state";
export const GOOGLE_VERIFIER_COOKIE = "editforge_google_verifier";

export function googleAuthOrigin(): string {
  const origin =
    process.env.EDITFORGE_GOOGLE_REDIRECT_ORIGIN?.trim() ||
    process.env.EDITFORGE_PASSKEY_ORIGIN?.trim() ||
    (process.env.NODE_ENV === "production" ? "https://editforge.online" : "http://localhost:3000");
  // A trailing slash would put //api/auth/google/callback into the redirect
  // URI, which Google refuses. The VPS callback trimmed it before the merge.
  return origin.replace(/\/+$/, "");
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
// from its own URL, so only values from these lists are ever shown there;
// anything else shows the reason alone and stays in the server log. The
// domain of a disallowed account is never shown on the page.

// Every code jose 6.2.12 defines (node_modules/jose/dist/webapi/util/errors.js);
// a test compares this list with jose/errors at runtime, so an upgrade that
// adds or removes a code fails loudly instead of dropping it off the page.
export const JOSE_CODES = [
  "ERR_JOSE_ALG_NOT_ALLOWED",
  "ERR_JOSE_GENERIC",
  "ERR_JOSE_NOT_SUPPORTED",
  "ERR_JWE_DECRYPTION_FAILED",
  "ERR_JWE_INVALID",
  "ERR_JWKS_INVALID",
  "ERR_JWKS_MULTIPLE_MATCHING_KEYS",
  "ERR_JWKS_NO_MATCHING_KEY",
  "ERR_JWKS_TIMEOUT",
  "ERR_JWK_INVALID",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_EXPIRED",
  "ERR_JWT_INVALID",
];
// The common network, DNS and TLS codes a fetch from the box to Google can
// fail with. A code not listed here still reaches the server log in full.
const NETWORK_CODES = [
  "ENOTFOUND",
  "EAI_AGAIN",
  "EAI_FAIL",
  "EPROTO",
  "ENETDOWN",
  "EADDRNOTAVAIL",
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_CLOSED",
  "UND_ERR_ABORTED",
  "UND_ERR_HTTP_PARSER",
  "UND_ERR_HEADERS_OVERFLOW",
  "UND_ERR_RES_CONTENT_LENGTH_MISMATCH",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "CERT_UNTRUSTED",
  "CERT_REVOKED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_SSL_WRONG_VERSION_NUMBER",
  "ERR_SSL_PACKET_LENGTH_TOO_LONG",
];
const ERROR_NAMES = ["Error", "TypeError", "SyntaxError", "RangeError", "AbortError", "TimeoutError", "unknown"];
const CLAIMS = ["iss", "aud", "exp", "nbf", "iat", "sub"];

const THROWN = new Set<string>([...JOSE_CODES, ...NETWORK_CODES, ...ERROR_NAMES]);
const JOSE_WITH_CLAIM = new Set<string>(
  JOSE_CODES.flatMap((code) => CLAIMS.map((claim) => `${code}-${claim}`)),
);
const TOKEN_DETAILS = new Set<string>([
  ...NETWORK_CODES.map((code) => `network-${code}`),
  ...ERROR_NAMES.map((name) => `network-${name}`),
]);

function detailFits(reason: GoogleFailure, detail: string): boolean {
  switch (reason) {
    case "google-error":
      return detail === "other" || GOOGLE_ERROR_CODES.has(detail);
    case "state-cookie":
      return detail === "state" || detail === "verifier" || detail === "state-verifier";
    case "token-exchange": {
      if (TOKEN_DETAILS.has(detail)) return true;
      const m = /^([1-5][0-9]{2})-(.+)$/.exec(detail);
      return Boolean(m && (TOKEN_ERROR_CODES.has(m[2]) || ["other", "no-error-field", "unparseable"].includes(m[2])));
    }
    case "id-token":
    case "session":
      return THROWN.has(detail) || JOSE_WITH_CLAIM.has(detail);
    default:
      return false;
  }
}

/** The line the login page shows for ?auth=google-failed, with the reason code appended. */
export function googleFailureMessage(reason: string | null, detail: string | null): string {
  const known = reason && Object.hasOwn(FAILURE_MESSAGES, reason) ? (reason as GoogleFailure) : null;
  if (!known) return "Google sign-in could not be verified for this studio.";
  const fits = Boolean(detail && detailFits(known, detail));
  return `${FAILURE_MESSAGES[known]} (${fits ? `${known} / ${detail}` : known})`;
}
