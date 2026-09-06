"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label, Input } from "@/components/ui/field";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/passkeys/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setPasskeyAvailable(Boolean(data.available)))
      .catch(() => setPasskeyAvailable(false));
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Sign in failed");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the studio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">EditForge</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy">Private studio</h1>
      <p className="mt-2 text-sm text-navy/60">
        This deployment holds live provider credentials. Use your verified device to continue.
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

      <form onSubmit={submit} className={`${passkeyAvailable ? "mt-5 border-t border-border pt-5" : "mt-8"} space-y-4`}>
        <p className="text-xs leading-relaxed text-navy/50">
          {passkeyAvailable
            ? "Recovery access"
            : "Sign in with the recovery password once, then create your first passkey in Security."}
        </p>
        <Label text="Access password">
          <span className="relative block">
            <Input
              type={showPassword ? "text" : "password"}
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-16"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide access password" : "Show access password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex min-w-14 items-center justify-center rounded-r-control px-3 text-xs font-semibold text-navy/55 transition-colors duration-flagship hover:bg-navy/5 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </Label>

        {error && (
          <p className="rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy || !password} className="w-full">
          {busy ? "Signing in…" : passkeyAvailable ? "Use recovery password" : "Sign in to enroll passkey"}
        </Button>
      </form>
    </main>
  );
}
