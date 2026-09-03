import { afterEach, describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  accessGateEnabled,
  authenticationConfigured,
  bearerFrom,
  isAuthenticated,
  secretsMatch,
  sessionSecretConfigured,
  sessionToken,
} from "./auth";

afterEach(() => {
  delete process.env.EDITFORGE_ACCESS_PASSWORD;
  delete process.env.EDITFORGE_MCP_TOKEN;
  delete process.env.EDITFORGE_SESSION_SECRET;
});

describe("secret comparison", () => {
  it("matches only an exact value", () => {
    expect(secretsMatch("abc", "abc")).toBe(true);
    expect(secretsMatch("abc", "abd")).toBe(false);
    expect(secretsMatch("abc", "abcd")).toBe(false);
    expect(secretsMatch("", "")).toBe(true);
  });
});

describe("session token", () => {
  it("is stable for a password and different for another", async () => {
    const a = await sessionToken("hunter2");
    expect(await sessionToken("hunter2")).toBe(a);
    expect(await sessionToken("hunter3")).not.toBe(a);
  });

  it("does not contain the password it was derived from", async () => {
    expect(await sessionToken("hunter2")).not.toContain("hunter2");
  });

  it("invalidates sessions when the signing secret rotates", async () => {
    process.env.EDITFORGE_SESSION_SECRET = "first-secret";
    const first = await sessionToken("hunter2");
    process.env.EDITFORGE_SESSION_SECRET = "second-secret";
    expect(await sessionToken("hunter2")).not.toBe(first);
  });
});

describe("bearer parsing", () => {
  it("reads a bearer token and ignores anything else", () => {
    expect(bearerFrom("Bearer abc")).toBe("abc");
    expect(bearerFrom("Basic abc")).toBe("");
    expect(bearerFrom(null)).toBe("");
  });
});

describe("authentication", () => {
  it("accepts the MCP bearer token", async () => {
    process.env.EDITFORGE_MCP_TOKEN = "tok-123";
    expect(await isAuthenticated({ authorization: "Bearer tok-123" })).toBe(true);
    expect(await isAuthenticated({ authorization: "Bearer wrong-01" })).toBe(false);
  });

  it("accepts a session cookie derived from the access password", async () => {
    process.env.EDITFORGE_ACCESS_PASSWORD = "studio-pass";
    const cookie = await sessionToken("studio-pass");
    expect(await isAuthenticated({ sessionCookie: cookie })).toBe(true);
    expect(await isAuthenticated({ sessionCookie: "not-the-token" })).toBe(false);
  });

  it("rejects a cookie minted from a different password", async () => {
    const stale = await sessionToken("old-password");
    process.env.EDITFORGE_ACCESS_PASSWORD = "new-password";
    // Rotating the password must invalidate sessions issued under the old one.
    expect(await isAuthenticated({ sessionCookie: stale })).toBe(false);
  });

  it("accepts the MCP token from the URL when one is offered", async () => {
    process.env.EDITFORGE_MCP_TOKEN = "tok-123";
    expect(await isAuthenticated({ urlToken: "tok-123" })).toBe(true);
    expect(await isAuthenticated({ urlToken: "tok-999" })).toBe(false);
  });

  it("does not accept the access password as a URL token", async () => {
    // The URL token is the MCP credential only; the password is for browsers
    // and must not become a shareable link.
    process.env.EDITFORGE_ACCESS_PASSWORD = "studio-pass";
    expect(await isAuthenticated({ urlToken: "studio-pass" })).toBe(false);
  });

  it("authenticates nobody when nothing is configured", async () => {
    // The property that matters: live keys on an open deployment are unusable
    // by anyone rather than usable by everyone.
    expect(await isAuthenticated({ authorization: "Bearer anything" })).toBe(false);
    expect(await isAuthenticated({ sessionCookie: "anything" })).toBe(false);
    expect(await isAuthenticated({})).toBe(false);
  });

  it("reports whether the access gate is on", () => {
    expect(accessGateEnabled()).toBe(false);
    process.env.EDITFORGE_ACCESS_PASSWORD = "x";
    expect(accessGateEnabled()).toBe(true);
  });

  it("reports configured API auth and session signing independently", () => {
    expect(authenticationConfigured()).toBe(false);
    expect(sessionSecretConfigured()).toBe(false);
    process.env.EDITFORGE_MCP_TOKEN = "token";
    process.env.EDITFORGE_SESSION_SECRET = "secret";
    expect(authenticationConfigured()).toBe(true);
    expect(sessionSecretConfigured()).toBe(true);
  });

  it("names the cookie once, so middleware and the login route cannot disagree", () => {
    expect(SESSION_COOKIE).toBe("editforge_session");
  });
});
