import { NextResponse } from "next/server";
import { HYPERFRAMES_FLOW } from "@/lib/avatar";

export async function POST(req: Request) {
  const body = await req.json();
  const prompt = String(body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  const designSource = body.designSource || "signal";

  return NextResponse.json({
    plan: {
      provider: "hyperframes-heygen",
      prompt: prompt.slice(0, 200),
      designSource,
      flow: HYPERFRAMES_FLOW,
    },
    allowed: true,
    note: "Use connected HyperFrames tools: compose → status → render. EditForge stores cut linkage + rubric gate.",
  });
}
