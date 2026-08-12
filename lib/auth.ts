/**
 * Access control for the studio.
 *
 * Two principles, both fail-closed:
 *
 *  1. When `EDITFORGE_ACCESS_PASSWORD` is set, the whole app is private —
 *     pages redirect to a login, APIs answer 401.
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
 * The cookie value for a given password. Derived rather than the password
 * itself, so a leaked cookie does not hand over the password used elsewhere.
 */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`editforge-session-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
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

  const password = process.env.EDITFORGE_ACCESS_PASSWORD;
  if (!password) return false;
  const cookie = opts.sessionCookie ?? "";
  if (!cookie) return false;
  return secretsMatch(cookie, await sessionToken(password));
}

/** True when the app is configured to be private. */
export function accessGateEnabled(): boolean {
  return Boolean(process.env.EDITFORGE_ACCESS_PASSWORD);
}
