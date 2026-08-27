import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isAuthenticated } from "@/lib/auth";
import { artifactDir, contentTypeForArtifact, isArtifactName } from "@/lib/artifacts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const authenticated = await isAuthenticated({
    authorization: req.headers.get("authorization"),
    sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
  });
  if (!authenticated) return Response.json({ error: "authentication required" }, { status: 401 });

  const dir = artifactDir();
  if (!dir) return Response.json({ error: "artifact store is not configured" }, { status: 503 });
  const { name } = await ctx.params;
  // The name rule lives with the store that writes these files, so what can be
  // written and what can be served cannot drift apart — a voice render landing
  // as .mp3 in a store that only served video was exactly that drift.
  if (!isArtifactName(name)) {
    return Response.json({ error: "invalid artifact name" }, { status: 400 });
  }
  const target = path.join(dir, name);
  try {
    const stat = await fs.stat(target);
    const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": contentTypeForArtifact(name),
        "Content-Length": String(stat.size),
        // Inline, so a reviewer opening a cut or a VO hears and sees it rather
        // than collecting files. The filename still travels with it.
        "Content-Disposition": `inline; filename="${name}"`,
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
