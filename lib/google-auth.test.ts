import { afterEach, describe, expect, it } from "vitest";
import { googleAuthConfig, googleAuthOrigin } from "./google-auth";

const ENV = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "EDITFORGE_GOOGLE_ALLOWED_EMAIL",
  "EDITFORGE_GOOGLE_REDIRECT_ORIGIN",
  "EDITFORGE_PASSKEY_ORIGIN",
  "NODE_ENV",
] as const;

afterEach(() => {
  for (const key of ENV) delete process.env[key];
});

describe("Google authentication configuration", () => {
  it("stays unavailable until every private setting is complete", () => {
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(googleAuthConfig()).toBeNull();
  });

  it("normalizes an exact comma-separated owner allowlist", () => {
    process.env.GOOGLE_CLIENT_ID = " client ";
    process.env.GOOGLE_CLIENT_SECRET = " secret ";
    process.env.EDITFORGE_GOOGLE_ALLOWED_EMAIL = " TEE@example.com, backup@example.com ";
    expect(googleAuthConfig()).toMatchObject({
      clientId: "client",
      clientSecret: "secret",
      allowedEmails: ["tee@example.com", "backup@example.com"],
    });
  });

  it("uses the explicit fixed redirect origin when configured", () => {
    process.env.EDITFORGE_GOOGLE_REDIRECT_ORIGIN = " https://studio.example.com ";
    expect(googleAuthOrigin()).toBe("https://studio.example.com");
  });
});
