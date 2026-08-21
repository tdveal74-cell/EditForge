import { controlRequestAuthorized } from "@/lib/control-auth";
import { fetchForgeArtifact } from "@/lib/forge-worker";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await controlRequestAuthorized(req))) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const upstream = await fetchForgeArtifact(id, req.headers.get("range"));
    const headers = new Headers();
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("Cache-Control", "private, no-store");
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}

