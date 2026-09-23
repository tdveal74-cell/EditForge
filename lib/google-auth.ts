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
 * Every way a Google callback can fail. Each one used to land on the same
 * "could not be verified" line with nothing logged, so a failed sign-in on the
 * live studio could not be told apart from any other. The reason travels in
 * the redirect and in the server log; neither ever carries a token, a code, a
 * secret or a full email address.
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
  | "session";

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
    "This browser did not keep the sign-in check between leaving for Google and coming back. Try again in the same tab, with private browsing off.",
  "state-mismatch": "The sign-in check did not match. Start again from this page.",
  "token-exchange": "The studio could not finish the sign-in with Google.",
  "no-id-token": "Google finished but sent no identity.",
  "id-token": "The studio could not verify Google's identity token.",
  "email-unverified": "That Google account's email is not verified.",
  "email-not-allowed": "That Google account is not the studio owner's. Choose the owner account.",
  session: "The studio could not start a session after Google verified you.",
};

/** The line the login page shows for ?auth=google-failed, with the reason code appended. */
export function googleFailureMessage(reason: string | null, detail: string | null): string {
  const known = reason && Object.hasOwn(FAILURE_MESSAGES, reason) ? (reason as GoogleFailure) : null;
  const base = known ? FAILURE_MESSAGES[known] : "Google sign-in could not be verified for this studio.";
  const code = [known, sanitizeFailureDetail(detail)].filter(Boolean).join(" / ");
  return code ? `${base} (${code})` : base;
}
