import { NextResponse } from "next/server";
import { googleAuthConfig } from "@/lib/google-auth";
import { sessionSecretConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ available: Boolean(googleAuthConfig()) && sessionSecretConfigured() });
}
