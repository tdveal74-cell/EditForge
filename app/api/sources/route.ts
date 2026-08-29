import { cookies } from "next/headers";
import { SESSION_COOKIE, isAuthenticated } from "@/lib/auth";
import { listSourceAssets, sourceCatalogConfigured } from "@/lib/source-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Return hashes for private source media without exposing the media itself. */
export async function GET(req: Request) {
  const authenticated = await isAuthenticated({
    authorization: req.headers.get("authorization"),
    sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
  });
  if (!authenticated) return Response.json({ error: "authentication required" }, { status: 401 });
  if (!sourceCatalogConfigured()) {
    return Response.json({ error: "source catalog is not configured", configured: false }, { status: 503 });
  }
  try {
    return Response.json(
      { configured: true, assets: await listSourceAssets() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message, configured: true }, { status: 500 });
  }
}
