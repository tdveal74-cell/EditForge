import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isAuthenticated } from "@/lib/auth";
import {
  artifactDir,
  contentTypeForArtifact,
  isArtifactName,
} from "@/lib/artifacts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const authenticated = await isAuthenticated({
    authorization: req.headers.get("authorization"),
    sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
  });
  if (!authenticated)
    return Response.json({ error: "authentication required" }, { status: 401 });

  const dir = artifactDir();
  if (!dir)
    return Response.json(
      { error: "artifact store is not configured" },
      { status: 503 },
    );
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
    const range = req.headers.get("range");
    let start = 0;
    let end = stat.size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
      if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
      else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= stat.size
      )
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
    }
    const stream = Readable.toWeb(
      createReadStream(target, { start, end }),
    ) as ReadableStream;
    const contentType = contentTypeForArtifact(name);
    const inline =
      /^(image|video|audio)\//.test(contentType) ||
      contentType.startsWith("text/plain");
    const download = new URL(req.url).searchParams.has("download");
    return new Response(stream, {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "Accept-Ranges": "bytes",
        ...(range
          ? { "Content-Range": `bytes ${start}-${end}/${stat.size}` }
          : {}),
        "Content-Length": String(end - start + 1),
        // Inline, so a reviewer opening a cut or a VO hears and sees it rather
        // than collecting files. The filename still travels with it.
        "Content-Disposition": `${inline && !download ? "inline" : "attachment"}; filename="${name}"`,
        "Cache-Control": "private, immutable, max-age=31536000",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ error: "artifact not found" }, { status: 404 });
    }
    return Response.json(
      { error: "artifact store read failed" },
      { status: 500 },
    );
  }
}
