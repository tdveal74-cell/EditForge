import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, URL_TOKEN_PARAM, accessGateEnabled, isAuthenticated } from "@/lib/auth";

/**
 * Makes the whole studio private when `EDITFORGE_ACCESS_PASSWORD` is set.
 *
 * Vercel's own deployment protection covers production only on paid plans, so
 * privacy lives in the app instead. With no password configured the app is open
 * — which is right for local development, and safe because spending money is
 * gated separately at the point of spend rather than only here.
 */

// Health stays reachable so uptime checks work against a private deployment,
// and the login route obviously cannot require a login.
const OPEN_PATHS = ["/login", "/api/login", "/api/health"];

export async function middleware(req: NextRequest) {
  if (!accessGateEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (OPEN_PATHS.some((p) => pathname === p)) return NextResponse.next();

  const authed = await isAuthenticated({
    authorization: req.headers.get("authorization"),
    sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
    // Scoped to the MCP endpoint on purpose: a token in a URL is the weaker
    // credential, so it opens the one door that needs it rather than the app.
    urlToken: pathname === "/api/mcp" ? req.nextUrl.searchParams.get(URL_TOKEN_PARAM) : null,
  });
  if (authed) return NextResponse.next();

  // An API caller gets a status it can act on; a browser gets the login form.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except static assets — API routes included, deliberately.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
