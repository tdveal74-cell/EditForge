import { NextResponse } from "next/server";
import { getAudioLaw, saveAudioLaw } from "@/lib/audiostore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ levels: await getAudioLaw() });
}

/** Replace the stored ladder. Mix reads this on the next session dump. */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await saveAudioLaw((body as { levels?: unknown }).levels);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ levels: result.levels });
}
