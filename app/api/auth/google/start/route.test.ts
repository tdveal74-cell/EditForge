import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const ENV = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  EDITFORGE_GOOGLE_ALLOWED_EMAIL: "owner@example.com",
  EDITFORGE_GOOGLE_REDIRECT_ORIGIN: "https://studio.example.com",
  EDITFORGE_SESSION_SECRET: "a-long-session-secret-for-tests",
};

beforeEach(() => Object.assign(process.env, ENV));
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
});

function start(path: string, headers: Record<string, string>) {
  return GET(new NextRequest(`http://web:3000${path}`, { headers }));
}

const ceremony = (res: Response) =>
  res.headers.getSetCookie().filter((c) => /^editforge_google_(state|verifier)=[^;]+/.test(c));

describe("Google start sets the ceremony cookies on the host Google will return to", () => {
  it("proceeds to Google on the configured host", async () => {
    const res = await start("/api/auth/google/start", { host: "studio.example.com" });
    expect(new URL(res.headers.get("location") || "").host).toBe("accounts.google.com");
    expect(ceremony(res)).toHaveLength(2);
  });

  it("trusts the forwarded host behind a proxy that rewrites Host", async () => {
    const res = await start("/api/auth/google/start", { host: "web:3000", "x-forwarded-host": "studio.example.com" });
    expect(new URL(res.headers.get("location") || "").host).toBe("accounts.google.com");
  });

  it("compares hosts without regard to case", async () => {
    const res = await start("/api/auth/google/start", { host: "STUDIO.Example.COM" });
    expect(new URL(res.headers.get("location") || "").host).toBe("accounts.google.com");
  });

  it("reads the first entry of a forwarded host list", async () => {
    const ok = await start("/api/auth/google/start", { host: "web:3000", "x-forwarded-host": "studio.example.com, evil.example" });
    expect(new URL(ok.headers.get("location") || "").host).toBe("accounts.google.com");
    const other = await start("/api/auth/google/start", { host: "web:3000", "x-forwarded-host": "evil.example, studio.example.com" });
    expect(other.headers.get("location")).toBe("https://studio.example.com/api/auth/google/start?canonical=1");
  });

  it("sends any other host to the configured one first, without setting cookies there", async () => {
    const res = await start("/api/auth/google/start", { host: "203.0.113.7" });
    expect(res.headers.get("location")).toBe("https://studio.example.com/api/auth/google/start?canonical=1");
    expect(ceremony(res)).toHaveLength(0);
  });

  it("never loops: a second pass proceeds even if the host still differs", async () => {
    const res = await start("/api/auth/google/start?canonical=1", { host: "web:3000" });
    expect(new URL(res.headers.get("location") || "").host).toBe("accounts.google.com");
    expect(ceremony(res)).toHaveLength(2);
  });
});
