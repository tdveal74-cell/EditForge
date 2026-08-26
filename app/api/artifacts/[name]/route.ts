import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function contentType(name: string): string {
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const authenticated = await isAuthenticated({
    authorization: req.headers.get("authorization"),
    sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
  });
  if (!authenticated) return Response.json({ error: "authentication required" }, { status: 401 });

  const artifactDir = process.env.EDITFORGE_ARTIFACT_DIR?.trim();
  if (!artifactDir) return Response.json({ error: "artifact store is not configured" }, { status: 503 });
  const { name } = await ctx.params;
  const safeName = path.basename(name);
  if (safeName !== name || !/^[A-Za-z0-9._-]+\.(mp4|mov)$/.test(safeName)) {
    return Response.json({ error: "invalid artifact name" }, { status: 400 });
  }
  const target = path.join(artifactDir, safeName);
  try {
    const stat = await fs.stat(target);
    const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": contentType(safeName),
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, immutable, max-age=31536000",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ error: "artifact not found" }, { status: 404 });
    }
    return Response.json({ error: "artifact store read failed" }, { status: 500 });
  }
}
