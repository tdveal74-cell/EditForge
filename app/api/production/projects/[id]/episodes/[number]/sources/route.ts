import { NextResponse } from "next/server";
import { controlRequestAuthorized } from "@/lib/control-auth";
import { setEpisodeSourceAssets } from "@/lib/production-store";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; number: string }> },
) {
  if (!(await controlRequestAuthorized(req))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const { id, number } = await params;
    const body = await req.json();
    const sourceAssetIds = Array.isArray(body.sourceAssetIds)
      ? body.sourceAssetIds.map(String)
      : [];
    const project = await setEpisodeSourceAssets(id, Number(number), sourceAssetIds);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

