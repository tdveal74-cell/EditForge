import { NextResponse } from "next/server";
import { storeBackend } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "editforge",
    version: "0.1.0",
    standard: "ultra-meta-supreme-flagship-aaa",
    store: storeBackend(),
  });
}
