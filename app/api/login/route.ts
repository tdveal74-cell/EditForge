import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Password authentication is intentionally retired. */
export async function POST() {
  return NextResponse.json(
    { error: "Password sign-in is disabled. Use Google sign-in." },
    { status: 410 }
  );
}
