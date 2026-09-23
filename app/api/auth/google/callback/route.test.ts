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
  });
});
