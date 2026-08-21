import { NextResponse } from "next/server";
import { getForgeWorkerHealth } from "@/lib/forge-worker";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ connected: true, health: await getForgeWorkerHealth() });
  } catch (error) {
    return NextResponse.json(
      { connected: false, error: (error as Error).message },
      { status: 503 },
    );
  }
}

