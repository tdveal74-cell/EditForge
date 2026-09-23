import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The identity token check is exercised through a stub so each exit of the
// callback can be reached without a real Google account.
const jwtVerify = vi.fn();
vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
}));
const listPasskeys = vi.fn();
vi.mock("@/lib/passkeys", () => ({ listPasskeys: () => listPasskeys() }));

const { GET } = await import("./route");

const ENV = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  EDITFORGE_GOOGLE_ALLOWED_EMAIL: "owner@example.com",
  EDITFORGE_GOOGLE_REDIRECT_ORIGIN: "https://studio.example.com",
  EDITFORGE_SESSION_SECRET: "a-long-session-secret-for-tests",
};

function callback(query: string, cookies: Record<string, string> = { editforge_google_state: "s1", editforge_google_verifier: "v1" }) {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(`https://studio.example.com/api/auth/google/callback?${query}`, {
    headers: cookie ? { cookie } : {},
  });
}

function landing(res: Response) {
  const url = new URL(res.headers.get("location") || "");
  return { path: url.pathname, reason: url.searchParams.get("reason"), detail: url.searchParams.get("detail"), url };
}

const fetchMock = vi.fn();

beforeEach(() => {
  Object.assign(process.env, ENV);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  jwtVerify.mockReset();
  listPasskeys.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function tokenOk() {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id_token: "header.payload.sig" }), { status: 200 }));
}

describe("Google callback names the exit it took", () => {
  it("not configured", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    const r = landing(await GET(callback("code=c&state=s1")));
    expect(r.reason).toBe("not-configured");
  });

  it("Google returned an error instead of a code", async () => {
    const r = landing(await GET(callback("error=access_denied&state=s1")));
    expect(r).toMatchObject({ path: "/login", reason: "google-error", detail: "access_denied" });
  });

  it("a crafted ?error= cannot put its own words in the redirect or the log", async () => {
    const r = landing(await GET(callback("error=Session%20expired.%20Call%20555-0100&state=s1")));
    expect(r).toMatchObject({ reason: "google-error", detail: "other" });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"detail":"other"'));
    expect(r.url.toString()).not.toContain("555");
  });

  it("no code", async () => {
    expect(landing(await GET(callback("state=s1"))).reason).toBe("no-code");
  });

  it("the browser dropped the ceremony cookies", async () => {
    const r = landing(await GET(callback("code=c&state=s1", {})));
    expect(r).toMatchObject({ reason: "state-cookie", detail: "state-verifier" });
  });

  it("state does not match", async () => {
    expect(landing(await GET(callback("code=c&state=other"))).reason).toBe("state-mismatch");
  });

  it("Google refused the token exchange, with its error code but not its description", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "redirect_uri_mismatch", error_description: "Bad Request secret-ish text" }), { status: 400 }),
    );
    const r = landing(await GET(callback("code=c&state=s1")));
    expect(r).toMatchObject({ reason: "token-exchange", detail: "400-redirect_uri_mismatch" });
    expect(r.url.toString()).not.toContain("secret");
  });

  it("a token error that is not a known code, or not a string, becomes other", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "invalid_grant\r\nX: 4/0AeanS0CODE" }), { status: 400 }));
    expect(landing(await GET(callback("code=c&state=s1"))).detail).toBe("400-other");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 400, message: "m" } }), { status: 400 }));
    expect(landing(await GET(callback("code=c&state=s1"))).detail).toBe("400-other");
    fetchMock.mockResolvedValue(new Response("<html>proxy</html>", { status: 502 }));
    expect(landing(await GET(callback("code=c&state=s1"))).detail).toBe("502-no-error-field");
  });

  it("a 200 from the token endpoint that is not JSON is a token-exchange failure, not a session one", async () => {
    fetchMock.mockResolvedValue(new Response("<html>captive portal</html>", { status: 200 }));
    expect(landing(await GET(callback("code=c&state=s1")))).toMatchObject({
      reason: "token-exchange",
      detail: "200-unparseable",
    });
  });

  it("a 200 whose JSON is null carries no identity", async () => {
    fetchMock.mockResolvedValue(new Response("null", { status: 200 }));
    expect(landing(await GET(callback("code=c&state=s1"))).reason).toBe("no-id-token");
  });

  it("the box could not reach Google's token endpoint", async () => {
    fetchMock.mockRejectedValue(Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }));
    expect(landing(await GET(callback("code=c&state=s1")))).toMatchObject({
      reason: "token-exchange",
      detail: "network-ENOTFOUND",
    });
  });

  it("no id token", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    expect(landing(await GET(callback("code=c&state=s1"))).reason).toBe("no-id-token");
  });

  it("the identity token failed verification", async () => {
    tokenOk();
    jwtVerify.mockRejectedValue(Object.assign(new Error("fetch failed"), { code: "ERR_JWKS_TIMEOUT" }));
    expect(landing(await GET(callback("code=c&state=s1")))).toMatchObject({ reason: "id-token", detail: "ERR_JWKS_TIMEOUT" });
  });

  it("the key fetch failed underneath jose, reporting the network cause", async () => {
    tokenOk();
    jwtVerify.mockRejectedValue(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }));
    expect(landing(await GET(callback("code=c&state=s1")))).toMatchObject({ reason: "id-token", detail: "ECONNRESET" });
  });

  it("a claim failure names the claim, so a clock running behind reads as nbf", async () => {
    tokenOk();
    jwtVerify.mockRejectedValue(Object.assign(new Error("x"), { code: "ERR_JWT_CLAIM_VALIDATION_FAILED", claim: "nbf" }));
    expect(landing(await GET(callback("code=c&state=s1"))).detail).toBe("ERR_JWT_CLAIM_VALIDATION_FAILED-nbf");
  });

  it("the log carries the sanitized detail, never the raw one", async () => {
    tokenOk();
    jwtVerify.mockRejectedValue(Object.assign(new Error("x"), { code: "bad code@owner example" }));
    await GET(callback("code=c&state=s1"));
    const line = JSON.parse(vi.mocked(console.warn).mock.calls.at(-1)?.[0] as string);
    expect(line).toEqual({ event: "google_signin_failed", reason: "id-token", detail: "bad-code-owner-example" });
  });

  it("the session exit: Google verified the owner but the studio could not sign a session", async () => {
    tokenOk();
    jwtVerify.mockResolvedValue({ payload: { email: "owner@example.com", email_verified: true } });
    listPasskeys.mockResolvedValue([]);
    delete process.env.EDITFORGE_SESSION_SECRET;
    expect(landing(await GET(callback("code=c&state=s1")))).toMatchObject({ reason: "session", detail: "Error" });
  });

  it("an unverified email", async () => {
    tokenOk();
    jwtVerify.mockResolvedValue({ payload: { email: "owner@example.com", email_verified: false } });
    expect(landing(await GET(callback("code=c&state=s1"))).reason).toBe("email-unverified");
  });

  it("a different Google account, reporting only its domain", async () => {
    tokenOk();
    jwtVerify.mockResolvedValue({ payload: { email: "someone.else@work.example", email_verified: true } });
    const r = landing(await GET(callback("code=c&state=s1")));
    expect(r).toMatchObject({ reason: "email-not-allowed", detail: "work.example" });
    expect(r.url.toString()).not.toContain("someone.else");
  });

  it("takes the domain after the last @", async () => {
    tokenOk();
    jwtVerify.mockResolvedValue({ payload: { email: '"someone.private@inner"@work.example', email_verified: true } });
    expect(landing(await GET(callback("code=c&state=s1"))).detail).toBe("work.example");
  });

  it("logs the reason on the server", async () => {
    await GET(callback("state=s1"));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"reason":"no-code"'));
  });
});

describe("Google callback success", () => {
  it("sends a first sign-in to passkey enrollment with a session cookie", async () => {
    tokenOk();
    jwtVerify.mockResolvedValue({ payload: { email: "OWNER@example.com", email_verified: true } });
    listPasskeys.mockResolvedValue([]);
    const res = await GET(callback("code=c&state=s1"));
    expect(landing(res).path).toBe("/security");
    const session = res.headers.getSetCookie().find((c) => c.startsWith("editforge_session="));
    expect(session).toBeDefined();
    // Strict is not sent on the redirect that follows a Google-started navigation.
    expect(session).toMatch(/;\s*SameSite=lax/i);
    const marker = res.headers.getSetCookie().find((c) => c.startsWith("editforge_signin_marker="));
    expect(marker).toMatch(/editforge_signin_marker=1;.*Max-Age=300/);
    expect(marker).toMatch(/Secure/);
    expect(marker).toMatch(/SameSite=none/i);
    expect(console.info).toHaveBeenCalledWith(
      JSON.stringify({ event: "google_signin_succeeded", landing: "/security" }),
    );
  });

  it("a passkey store that answers with something other than a list still signs the owner in", async () => {
    tokenOk();
    jwtVerify.mockResolvedValue({ payload: { email: "owner@example.com", email_verified: true } });
    listPasskeys.mockResolvedValue(null);
    const res = await GET(callback("code=c&state=s1"));
    expect(landing(res).path).toBe("/");
    expect(res.headers.getSetCookie().some((c) => c.startsWith("editforge_session="))).toBe(true);
  });

  it("a passkey store that throws synchronously still signs the owner in", async () => {
    tokenOk();
    jwtVerify.mockResolvedValue({ payload: { email: "owner@example.com", email_verified: true } });
    listPasskeys.mockImplementation(() => {
      throw new Error("store unreadable");
    });
    const res = await GET(callback("code=c&state=s1"));
    expect(landing(res).path).toBe("/");
    expect(res.headers.getSetCookie().some((c) => c.startsWith("editforge_session="))).toBe(true);
  });

  it("goes home once a passkey exists", async () => {
    tokenOk();
    jwtVerify.mockResolvedValue({ payload: { email: "owner@example.com", email_verified: true } });
    listPasskeys.mockResolvedValue([{ id: "k" }]);
    expect(landing(await GET(callback("code=c&state=s1"))).path).toBe("/");
  });
});

describe("login page message", () => {
  it("names the reason and detail", async () => {
    const { googleFailureMessage } = await import("@/lib/google-auth");
    expect(googleFailureMessage("token-exchange", "401-invalid_client")).toBe(
      "The studio could not finish the sign-in with Google. (token-exchange / 401-invalid_client)",
    );
  });

  it("does not treat an inherited property name as a reason", async () => {
    const { googleFailureMessage } = await import("@/lib/google-auth");
    expect(googleFailureMessage("constructor", null)).toBe("Google sign-in could not be verified for this studio.");
    expect(googleFailureMessage("__proto__", "img-src-x-onerror")).toBe("Google sign-in could not be verified for this studio.");
  });

  it("shows a detail only when it fits its reason, so a crafted link cannot write on the page", async () => {
    const { googleFailureMessage } = await import("@/lib/google-auth");
    const shown = (reason: string, detail: string) => googleFailureMessage(reason, detail).includes(detail);
    expect(shown("google-error", "access_denied")).toBe(true);
    expect(shown("google-error", "Session-expired-call-555-0100")).toBe(false);
    // The domain stays in the redirect and the log; the page never shows it.
    expect(shown("email-not-allowed", "gmail.com")).toBe(false);
    expect(shown("email-not-allowed", "editforge-owner-recovery.com")).toBe(false);
    expect(shown("token-exchange", "401-invalid_client")).toBe(true);
    expect(shown("token-exchange", "400-redirect_uri_mismatch")).toBe(true);
    expect(shown("token-exchange", "network-ENOTFOUND")).toBe(true);
    expect(shown("token-exchange", "Re-verify-at-evil-example.com")).toBe(false);
    expect(shown("id-token", "ERR_JWT_CLAIM_VALIDATION_FAILED-nbf")).toBe(true);
    expect(shown("id-token", "ERR_JWKS_TIMEOUT")).toBe(true);
    expect(shown("id-token", "ECONNRESET")).toBe(true);
    expect(shown("id-token", "UND_ERR_CONNECT_TIMEOUT")).toBe(true);
    expect(shown("id-token", "TypeError")).toBe(true);
    expect(shown("id-token", "CALL_18005550100_TO_RESTORE_ACCESS")).toBe(false);
    expect(shown("session", "Error")).toBe(true);
    expect(shown("session", "SyntaxError")).toBe(true);
    expect(shown("session", "Reverify_at_editforge_help-com")).toBe(false);
    expect(shown("state-cookie", "state-verifier")).toBe(true);
    expect(shown("state-mismatch", "anything")).toBe(false);
    expect(googleFailureMessage("google-error", "Session-expired")).toBe("Google did not complete the sign-in. (google-error)");
  });

  it("names a session that did not come back after a good callback", async () => {
    const { googleFailureMessage } = await import("@/lib/google-auth");
    expect(googleFailureMessage("session-not-sent", null)).toMatch(/did not send the studio's session back.*\(session-not-sent\)$/);
  });
});
