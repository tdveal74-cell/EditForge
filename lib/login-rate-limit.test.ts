import { afterEach, describe, expect, it } from "vitest";
import { clearLoginFailures, loginRateLimitStatus, recordLoginFailure } from "./login-rate-limit";

const KEY = "test-client";

afterEach(() => clearLoginFailures(KEY));

describe("login rate limit", () => {
  it("blocks the fifth failed attempt for fifteen minutes", () => {
    const now = 1_000;
    for (let attempt = 1; attempt < 5; attempt += 1) {
      expect(recordLoginFailure(KEY, now).allowed).toBe(true);
    }
    expect(recordLoginFailure(KEY, now)).toEqual({ allowed: false, retryAfterSeconds: 900 });
    expect(loginRateLimitStatus(KEY, now + 1_000).allowed).toBe(false);
    expect(loginRateLimitStatus(KEY, now + 900_000).allowed).toBe(true);
  });

  it("clears failures after a successful login", () => {
    recordLoginFailure(KEY, 1_000);
    clearLoginFailures(KEY);
    expect(loginRateLimitStatus(KEY, 1_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});
