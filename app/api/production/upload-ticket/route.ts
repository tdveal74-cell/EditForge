import { NextResponse } from "next/server";
import { controlRequestAuthorized } from "@/lib/control-auth";
import { createForgeUploadTicket } from "@/lib/forge-worker";

export async function POST(req: Request) {
  if (!(await controlRequestAuthorized(req))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const ticket = await createForgeUploadTicket({
      filename: String(body.filename ?? ""),
      kind: String(body.kind ?? ""),
      mimeType: String(body.mimeType ?? "application/octet-stream"),
      maxBytes: Number(body.maxBytes ?? 0),
      sha256: String(body.sha256 ?? ""),
      consentId: body.consentId ? String(body.consentId) : undefined,
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

