import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { issueChallenge, listPasskeys, passkeyConfig } from "@/lib/passkeys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const passkeys = await listPasskeys();
  if (passkeys.length === 0) {
    return NextResponse.json({ error: "No passkey is enrolled yet." }, { status: 404 });
  }
  const { rpID } = passkeyConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    timeout: 60_000,
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.id,
      transports: passkey.transports,
    })),
  });
  const challengeId = await issueChallenge("authentication", options.challenge);
  return NextResponse.json({ options, challengeId });
}

