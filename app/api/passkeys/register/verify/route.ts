import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { consumeChallenge, listPasskeys, passkeyConfig, savePasskey } from "@/lib/passkeys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RegistrationResponse = Parameters<typeof verifyRegistrationResponse>[0]["response"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    challengeId?: string;
    label?: string;
    response?: RegistrationResponse;
  };
  if (!body.challengeId || !body.response) {
    return NextResponse.json({ error: "Incomplete passkey response." }, { status: 400 });
  }
  const expectedChallenge = await consumeChallenge(body.challengeId, "registration");
  if (!expectedChallenge) {
    return NextResponse.json({ error: "The passkey request expired. Try again." }, { status: 400 });
  }
  const { rpID, origin } = passkeyConfig();
  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified) throw new Error("Passkey verification failed");
    const { credential, credentialBackedUp, credentialDeviceType } = verification.registrationInfo;
    const existing = await listPasskeys();
    if (existing.some((item) => item.id === credential.id)) {
      return NextResponse.json({ error: "This passkey is already registered." }, { status: 409 });
    }
    await savePasskey({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      label: String(body.label || "Primary passkey").trim().slice(0, 60) || "Primary passkey",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Passkey enrollment failed." }, { status: 400 });
  }
}

