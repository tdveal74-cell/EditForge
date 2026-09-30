import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  URL_TOKEN_PARAM,
  authenticationConfigured,
  bearerFrom,
  isAuthenticated,
  secretsMatch,
} from "@/lib/auth";
import { SIGNIN_MARKER_COOKIE } from "@/lib/google-auth";

/**
 * Makes the whole studio private when any application credential is set.
 *
 * Vercel's own deployment protection covers production only on paid plans, so
 * privacy lives in the app instead. Credential-free local development remains
 * convenient, while production fails closed instead of exposing an accidental
 * public data plane.
 */

// Health stays reachable so uptime checks work against a private deployment,
// and the login route obviously cannot require a login.
const OPEN_PATHS = [
  "/login",
  "/api/health",
  "/manifest.webmanifest",
  "/sw.js",
  "/api/passkeys/status",
  "/api/passkeys/authenticate/options",
  "/api/passkeys/authenticate/verify",
  "/api/auth/google/status",
  "/api/auth/google/start",
  "/api/auth/google/callback",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (OPEN_PATHS.some((p) => pathname === p) || pathname.startsWith("/icons/")) return NextResponse.next();

  const authenticationRequired = process.env.NODE_ENV === "production" || authenticationConfigured();
  if (!authenticationRequired) return NextResponse.next();
  if (!authenticationConfigured()) {
    const message = "Production authentication is not configured";
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: message }, { status: 503 })
      : new NextResponse(message, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Worker receipts use a separate token and are verified again by the route.
  // Let only the exact callback shape reach that verification layer.
  const workerToken = process.env.EDITFORGE_WORKER_TOKEN;
  if (
    req.method === "POST" &&
    /^\/api\/edits\/[^/]+$/.test(pathname) &&
    workerToken &&
    secretsMatch(bearerFrom(req.headers.get("authorization")), workerToken)
  ) {
    return NextResponse.next();
  }

  const authed = await isAuthenticated({
    authorization: req.headers.get("authorization"),
    sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
    // Scoped to the MCP endpoint on purpose: a token in a URL is the weaker
    // credential, so it opens the one door that needs it rather than the app.
    urlToken: pathname === "/api/mcp" ? req.nextUrl.searchParams.get(URL_TOKEN_PARAM) : null,
  });
  if (authed) {
    if (!req.cookies.get(SIGNIN_MARKER_COOKIE)?.value) return NextResponse.next();
    // The session came back, so the sign-in marker has done its job.
    const response = NextResponse.next();
    response.cookies.set(SIGNIN_MARKER_COOKIE, "", { sameSite: "none", secure: true, path: "/", maxAge: 0 });
    return response;
  }

  // An API caller gets a status it can act on; a browser gets the login form.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  // A Google sign-in finished minutes ago, yet no valid session came with this
  // request. Name it rather than show a login page that looks untouched.
  // Only for a page the browser is navigating to: an image or frame another
  // site pulls in is not the owner arriving, and must not spend the marker.
  const dest = req.headers.get("sec-fetch-dest");
  if (req.cookies.get(SIGNIN_MARKER_COOKIE)?.value && (dest === null || dest === "document")) {
    const reason = req.cookies.get(SESSION_COOKIE)?.value ? "session-invalid" : "session-not-sent";
    url.search = new URLSearchParams({ auth: "google-failed", reason }).toString();
    console.warn(JSON.stringify({ event: "google_signin_failed", reason, detail: "" }));
    const response = NextResponse.redirect(url);
    response.cookies.set(SIGNIN_MARKER_COOKIE, "", { sameSite: "none", secure: true, path: "/", maxAge: 0 });
    return response;
  }
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except static assets — API routes included, deliberately.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
