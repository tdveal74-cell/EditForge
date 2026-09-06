"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState<boolean | null>(null);
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/passkeys/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setPasskeyAvailable(Boolean(data.available)))
      .catch(() => setPasskeyAvailable(false));
    fetch("/api/auth/google/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setGoogleAvailable(Boolean(data.available)))
      .catch(() => setGoogleAvailable(false));
    const authError = new URLSearchParams(window.location.search).get("auth");
    if (authError) {
      queueMicrotask(() =>
        setError(
          authError === "google-unavailable"
            ? "Google sign-in is not configured for this studio."
            : "Google sign-in could not be verified for this studio."
        )
      );
    }
  }, []);

  async function passkeySignIn() {
    setBusy(true);
    setError(null);
    try {
      const { browserSupportsWebAuthn, startAuthentication } = await import("@simplewebauthn/browser");
      if (!browserSupportsWebAuthn()) throw new Error("This browser does not support passkeys.");
      const optionsRes = await fetch("/api/passkeys/authenticate/options", { method: "POST" });
      const request = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(request.error || "Could not start passkey sign-in.");
      const response = await startAuthentication({ optionsJSON: request.options });
      const verifyRes = await fetch("/api/passkeys/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: request.challengeId, response }),
      });
      const result = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(result.error || "Passkey sign-in failed.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Passkey sign-in was cancelled.");
    } finally {
      setBusy(false);
    }
  }

  const loading = passkeyAvailable === null || googleAvailable === null;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">EditForge</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy">Private studio</h1>
      <p className="mt-2 text-sm text-navy/60">
        Google verifies the studio owner. After enrollment, your device passkey becomes the fastest way back in.
      </p>

      {passkeyAvailable && (
        <button
          type="button"
          onClick={() => void passkeySignIn()}
          disabled={busy}
          className="mt-8 flex min-h-12 w-full items-center justify-between rounded-control bg-navy px-4 text-sm font-semibold text-surface shadow-card transition-transform duration-flagship hover:-translate-y-0.5 disabled:opacity-50"
        >
          <span>Continue with passkey</span>
          <span aria-hidden="true" className="text-lg text-amber">◇</span>
        </button>
      )}

      {googleAvailable && (
        <a
          href="/api/auth/google/start"
          className={`${passkeyAvailable ? "mt-3" : "mt-8"} flex min-h-12 w-full items-center justify-between rounded-control border border-border-strong bg-white px-4 text-sm font-semibold text-navy shadow-card transition-transform duration-flagship hover:-translate-y-0.5`}
        >
          <span>{passkeyAvailable ? "Use Google recovery" : "Start with Google"}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
            <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z" />
            <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.5 14.1A6 6 0 0 1 6.2 12c0-.7.1-1.4.3-2.1V7.3H3.2A10 10 0 0 0 2 12c0 1.7.4 3.3 1.2 4.7l3.3-2.6Z" />
            <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.8 5.3l3.3 2.6A5.8 5.8 0 0 1 12 5.9Z" />
          </svg>
        </a>
      )}

      {loading && <p className="mt-8 text-sm text-navy/50">Checking secure sign-in…</p>}

      {!loading && !googleAvailable && !passkeyAvailable && (
        <p role="alert" className="mt-8 rounded-control border border-amber-300 bg-amber-50 px-3 py-3 text-sm leading-relaxed text-amber-950">
          Owner sign-in is awaiting Google configuration. No password fallback is enabled.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-navy/45">
        First visit: Google. Returning visits: passkey, with Google kept as recovery.
      </p>
    </main>
  );
}
