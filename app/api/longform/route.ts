import { NextResponse } from "next/server";
import { getLongformProject, saveLongformProject } from "@/lib/longformstore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ project: await getLongformProject() });
}

/** Replace the stored episode. /longform hydrates this copy, not the sample. */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await saveLongformProject((body as { project?: unknown }).project ?? body);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ project: result.project });
}
