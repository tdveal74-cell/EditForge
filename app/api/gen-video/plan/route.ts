import { NextResponse } from "next/server";
import { GEN_PROVIDERS, GEN_QUALITY_BAR, pickProvider, providerReady } from "@/lib/genvideo";

const ASPECTS = ["16:9", "9:16"] as const;

export async function POST(req: Request) {
  const body = await req.json();
  const prompt = String(body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  const provider = pickProvider(body.provider);
  const meta = GEN_PROVIDERS.find((p) => p.id === provider)!;
  const ready = providerReady(provider);
  // Runway text-to-video takes 2-10s. Planning 30 and refusing at submit is a
  // plan that describes work the provider will not do.
  const durationSec = Math.min(10, Math.max(2, Number(body.durationSec) || 5));
  const aspect = ASPECTS.includes(body.aspect) ? body.aspect : ASPECTS[0];
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
    live: ready && provider !== "mock",
    note: !meta.liveWired && provider !== "mock"
      ? `${meta.label} has no implemented API shape here yet — plan only, and a run would refuse`
      : ready
        ? `${meta.label} is configured — running the job submits it and polls for the render`
        : `Set ${meta.envKeys.join(" or ") || "the provider key"} for live gen; mock plan only`,
  });
}
