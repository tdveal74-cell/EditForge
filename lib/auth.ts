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
export const GOOGLE_STATE_COOKIE = "editforge_google_state";
const GOOGLE_SESSION_VERSION = "g1";
const GOOGLE_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

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

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export type GoogleSession = { email: string; exp: number };

export async function createGoogleSession(email: string, now = Date.now()): Promise<string> {
  const secret = process.env.EDITFORGE_SESSION_SECRET?.trim();
  if (!secret) throw new Error("EDITFORGE_SESSION_SECRET is required");
  const payload = textToBase64Url(JSON.stringify({ email: email.trim().toLowerCase(), exp: Math.floor(now / 1000) + GOOGLE_SESSION_MAX_AGE } satisfies GoogleSession));
  const unsigned = `${GOOGLE_SESSION_VERSION}.${payload}`;
  return `${unsigned}.${await hmac(unsigned, secret)}`;
}

export async function readGoogleSession(token: string, now = Date.now()): Promise<GoogleSession | null> {
  const secret = process.env.EDITFORGE_SESSION_SECRET?.trim();
  const allowed = process.env.EDITFORGE_GOOGLE_ALLOWED_EMAIL?.trim().toLowerCase();
  if (!secret || !allowed || !token) return null;
  const [version, payload, signature, ...extra] = token.split(".");
  if (version !== GOOGLE_SESSION_VERSION || !payload || !signature || extra.length) return null;
  const expected = await hmac(`${version}.${payload}`, secret);
  if (!secretsMatch(signature, expected)) return null;
  try {
    const parsed = JSON.parse(base64UrlToText(payload)) as Partial<GoogleSession>;
    if (typeof parsed.email !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.email.toLowerCase() !== allowed || parsed.exp <= Math.floor(now / 1000)) return null;
    return { email: parsed.email.toLowerCase(), exp: parsed.exp };
  } catch {
    return null;
  }
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

  if (await readGoogleSession(opts.sessionCookie ?? "")) return true;

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
