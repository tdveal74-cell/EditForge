import { NextResponse } from "next/server";
import { GEN_PROVIDERS, GEN_QUALITY_BAR, pickProvider } from "@/lib/genvideo";

export async function POST(req: Request) {
  const body = await req.json();
  const prompt = String(body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  const provider = pickProvider(body.provider);
  const meta = GEN_PROVIDERS.find((p) => p.id === provider)!;
  const configured = meta.envKey ? Boolean(process.env[meta.envKey]) : true;
  const durationSec = Math.min(30, Math.max(2, Number(body.durationSec) || 5));
  const aspect = body.aspect === "9:16" || body.aspect === "1:1" ? body.aspect : "16:9";
  const quality = body.quality === "broadcast-intent" || body.quality === "social" ? body.quality : "draft";

  return NextResponse.json({
    plan: {
      provider,
      mode: body.mode || "text-to-video",
      prompt: prompt.slice(0, 400),
      durationSec,
      aspect,
      quality,
      estimatedCostBand: provider === "mock" ? "none" : "provider-metered",
    },
    qualityBar: GEN_QUALITY_BAR,
    allowed: true,
    live: configured && provider !== "mock",
    note: configured
      ? `Provider ${provider} key present — wire worker call next`
      : `Set ${meta.envKey || "provider key"} for live gen; mock plan only`,
  });
}
