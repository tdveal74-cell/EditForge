import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { issueChallenge, listPasskeys, passkeyConfig } from "@/lib/passkeys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const passkeys = await listPasskeys();
  if (passkeys.length >= 5) {
    return NextResponse.json({ error: "Remove a passkey before adding another." }, { status: 409 });
  }
  const { rpID, rpName } = passkeyConfig();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: "tee@editforge",
    userID: new TextEncoder().encode("editforge-operator-tee"),
    userDisplayName: "Tee",
    attestationType: "none",
    timeout: 60_000,
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    excludeCredentials: passkeys.map((passkey) => ({
      id: passkey.id,
      transports: passkey.transports,
    })),
  });
  const challengeId = await issueChallenge("registration", options.challenge);
  return NextResponse.json({ options, challengeId });
}
