import { NextResponse } from "next/server";
import { AVATAR_ENV, AVATAR_FLOW } from "@/lib/avatar";

export async function POST(req: Request) {
  const body = await req.json();
  const prompt = String(body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  const designSource = body.designSource || "signal";

  // Names and booleans only, same rule as /api/health — enough to see why a run
  // would refuse, nothing worth stealing.
  const missing = [AVATAR_ENV.apiKey, AVATAR_ENV.avatar, AVATAR_ENV.voice].filter(
    (key) => !process.env[key]?.trim()
  );

  return NextResponse.json({
    plan: {
      provider: "heygen",
      prompt: prompt.slice(0, 200),
      designSource,
      flow: AVATAR_FLOW,
    },
    allowed: true,
    configured: missing.length === 0,
    missing,
    note:
      missing.length === 0
        ? "HeyGen is configured — run the job to render, then attach the result to a cut and clear the rubric before master."
        : `Plan only. HeyGen will refuse until ${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} set.`,
  });
}
