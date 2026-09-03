import { NextResponse } from "next/server";
import { SESSION_COOKIE, secretsMatch, sessionToken } from "@/lib/auth";
import {
  clearLoginFailures,
  loginRateLimitStatus,
  recordLoginFailure,
} from "@/lib/login-rate-limit";

export const dynamic = "force-dynamic";

function clientKey(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many sign-in attempts. Try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/** Exchange the access password for a session cookie. */
export async function POST(req: Request) {
  const key = clientKey(req);
  const currentLimit = loginRateLimitStatus(key);
  if (!currentLimit.allowed) return rateLimited(currentLimit.retryAfterSeconds);

  const password = process.env.EDITFORGE_ACCESS_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "No access password is configured, so there is nothing to sign in to." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const provided = String(body.password ?? "");
  if (!provided || !secretsMatch(provided, password)) {
    // One message for both wrong and empty: nothing here should help someone
    // work out how close they got.
    const limit = recordLoginFailure(key);
    return limit.allowed
      ? NextResponse.json({ error: "Incorrect password" }, { status: 401 })
      : rateLimited(limit.retryAfterSeconds);
  }

  clearLoginFailures(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
