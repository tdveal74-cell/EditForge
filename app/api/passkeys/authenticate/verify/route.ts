import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { consumeChallenge, getPasskey, passkeyConfig, updatePasskeyCounter } from "@/lib/passkeys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuthenticationResponse = Parameters<typeof verifyAuthenticationResponse>[0]["response"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    challengeId?: string;
    response?: AuthenticationResponse;
  };
  if (!body.challengeId || !body.response?.id) {
    return NextResponse.json({ error: "Incomplete passkey response." }, { status: 400 });
  }
  const expectedChallenge = await consumeChallenge(body.challengeId, "authentication");
  if (!expectedChallenge) {
    return NextResponse.json({ error: "The passkey request expired. Try again." }, { status: 400 });
  }
  const stored = await getPasskey(body.response.id);
  if (!stored) {
    return NextResponse.json({ error: "This passkey is not registered with EditForge." }, { status: 401 });
  }
  const { rpID, origin } = passkeyConfig();
  try {
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.id,
        publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
        counter: stored.counter,
        transports: stored.transports,
      },
    });
    if (!verification.verified) throw new Error("Passkey verification failed");
    await updatePasskeyCounter(stored.id, verification.authenticationInfo.newCounter);

    const password = process.env.EDITFORGE_ACCESS_PASSWORD;
    if (!password) {
      return NextResponse.json({ error: "The recovery credential is not configured." }, { status: 503 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await sessionToken(password), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Passkey verification failed." }, { status: 401 });
  }
}

