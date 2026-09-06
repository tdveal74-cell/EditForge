/**
 * Access control for the studio.
 *
 * Two principles, both fail-closed:
 *
 *  1. Production never silently becomes public. Browser identity and MCP
 *     credentials turn the gate on, and production refuses protected requests
 *     when authentication is not configured.
 *  2. Spending money always requires authentication, whether or not a password
 *     is configured. With no password and no MCP token, nothing can
 *     authenticate, so no billable provider can be reached at all. Live keys
 *     sitting on an open deployment then cost nothing rather than everything.
 *
 * Edge-safe: Web Crypto only, no node:crypto, so middleware can use it.
 */

export const SESSION_COOKIE = "editforge_session";

/** Constant-time compare, so a wrong value cannot be found a character at a time. */
export function secretsMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/**
 * The shared studio-session proof minted after any approved sign-in method.
 * It is independent of the recovery password so a passkey or Google identity
 * can recover access and rotate that password without invalidating its own
 * newly authenticated session.
 */
export async function sessionToken(): Promise<string> {
  const encoder = new TextEncoder();
  const secret =
    process.env.EDITFORGE_SESSION_SECRET?.trim() ||
    process.env.EDITFORGE_ACCESS_PASSWORD?.trim();
  if (!secret) throw new Error("EditForge session signing is not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode("editforge-session-v3:studio"));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Bearer token from an Authorization header, or "" when absent. */
export function bearerFrom(header: string | null): string {
  const value = header ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

/** Query parameter carrying the MCP token when headers are not available. */
export const URL_TOKEN_PARAM = "key";

/**
 * Whether a caller has valid credentials — the MCP bearer token, the same
 * token in the URL, or a session cookie from the login form.
 *
 * Takes the values rather than a request object: middleware holds a
 * NextRequest with `.cookies`, but a route handler receives a plain Request
 * that has no cookie accessor, and passing one where the other is expected
 * fails at runtime rather than at the type level.
 *
 * `urlToken` exists because some MCP clients only accept a URL — there is no
 * field to put a header in. It is weaker than the header: URLs are recorded in
 * server and proxy logs, where headers usually are not. Callers pass it only
 * for the MCP endpoint, so it never unlocks the rest of the app.
 */
export async function isAuthenticated(opts: {
  authorization?: string | null;
  sessionCookie?: string | null;
  urlToken?: string | null;
}): Promise<boolean> {
  const mcpToken = process.env.EDITFORGE_MCP_TOKEN;
  if (mcpToken) {
    const bearer = bearerFrom(opts.authorization ?? null);
    if (bearer && secretsMatch(bearer, mcpToken)) return true;
    const fromUrl = opts.urlToken ?? "";
    if (fromUrl && secretsMatch(fromUrl, mcpToken)) return true;
  }

  const cookie = opts.sessionCookie ?? "";
  if (!cookie) return false;
  if (!process.env.EDITFORGE_SESSION_SECRET?.trim() && !process.env.EDITFORGE_ACCESS_PASSWORD?.trim()) {
    return false;
  }
  return secretsMatch(cookie, await sessionToken());
}

/** True when the app is configured to be private. */
export function accessGateEnabled(): boolean {
  return Boolean(process.env.EDITFORGE_ACCESS_PASSWORD);
}

/** True when a configured identity or MCP credential can protect a request. */
export function authenticationConfigured(): boolean {
  const google = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.EDITFORGE_GOOGLE_ALLOWED_EMAIL
  );
  return Boolean(
    process.env.EDITFORGE_ACCESS_PASSWORD ||
    process.env.EDITFORGE_MCP_TOKEN ||
    (google && process.env.EDITFORGE_SESSION_SECRET?.trim())
  );
}

/** A separate signing key prevents an exposed cookie from becoming a password oracle. */
export function sessionSecretConfigured(): boolean {
  return Boolean(process.env.EDITFORGE_SESSION_SECRET?.trim());
}
