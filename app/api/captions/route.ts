import { NextResponse } from "next/server";
import { getCaptionCues, saveCaptionCues } from "@/lib/captionstore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ cues: await getCaptionCues() });
}

/** Replace the stored cues. The picture overlay hydrates this copy. */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await saveCaptionCues((body as { cues?: unknown }).cues);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ cues: result.cues });
}
