import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { POST as logout } from "./app/api/auth/logout/route";
import { sessionToken } from "./lib/auth";

const ENV = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  EDITFORGE_GOOGLE_ALLOWED_EMAIL: "owner@example.com",
  EDITFORGE_SESSION_SECRET: "a-long-session-secret-for-tests",
};

beforeEach(() => {
  Object.assign(process.env, ENV);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  vi.restoreAllMocks();
});

function page(path: string, cookies: Record<string, string>) {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(`https://studio.example.com${path}`, { headers: cookie ? { cookie } : {} });
}

const where = (res: Response) => {
  const u = new URL(res.headers.get("location") || "http://x/");
  return u.pathname + u.search;
};

describe("proxy after a Google sign-in", () => {
  const cleared = (res: Response) => res.headers.getSetCookie().some((c) => /^editforge_signin_marker=;.*Max-Age=0/.test(c));
  const logged = () => vi.mocked(console.warn).mock.calls.map((c) => JSON.parse(String(c[0])));

  it("names a session the browser did not send back, on the page and in the log", async () => {
    const res = await proxy(page("/security", { editforge_signin_marker: "1" }));
    expect(where(res)).toBe("/login?auth=google-failed&reason=session-not-sent");
    expect(cleared(res)).toBe(true);
    expect(logged()).toEqual([{ event: "google_signin_failed", reason: "session-not-sent", detail: "" }]);
  });

  it("names a session that came back but did not verify, on the page and in the log", async () => {
    const res = await proxy(page("/security", { editforge_signin_marker: "1", editforge_session: "stale" }));
    expect(where(res)).toBe("/login?auth=google-failed&reason=session-invalid");
    expect(logged()).toEqual([{ event: "google_signin_failed", reason: "session-invalid", detail: "" }]);
  });

  it("an image or frame another site pulls in does not spend the marker", async () => {
    const req = page("/jobs", { editforge_signin_marker: "1" });
    req.headers.set("sec-fetch-dest", "image");
    const res = await proxy(req);
    expect(where(res)).toBe("/login");
    expect(cleared(res)).toBe(false);
    expect(logged()).toEqual([]);
  });

  it("without the marker, an unauthenticated page still gets a plain login", async () => {
    expect(where(await proxy(page("/security", {})))).toBe("/login");
  });

  it("lets a valid session through and retires the marker, since the session came back", async () => {
    const res = await proxy(page("/security", { editforge_signin_marker: "1", editforge_session: await sessionToken() }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(cleared(res)).toBe(true);
  });

  it("a valid session with no marker sets no cookie at all", async () => {
    const res = await proxy(page("/security", { editforge_session: await sessionToken() }));
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("an API caller still gets a 401, marker or not", async () => {
    const res = await proxy(page("/api/jobs", { editforge_signin_marker: "1" }));
    expect(res.status).toBe(401);
  });

  it("logout clears the marker so a quick logout is not reported as a lost session", async () => {
    const res = await logout();
    expect(res.headers.getSetCookie().some((c) => /^editforge_signin_marker=;.*Max-Age=0/.test(c))).toBe(true);
  });
});
