"use client";

import { useCallback, useEffect, useState } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type PasskeySummary = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  backedUp: boolean;
};

export default function SecurityPage() {
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [label, setLabel] = useState("Tee’s passkey");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/passkeys", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load passkeys.");
    setPasskeys(data.passkeys);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/passkeys", { cache: "no-store" })
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok) throw new Error(data.error || "Could not load passkeys.");
        if (active) setPasskeys(data.passkeys);
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);

  async function enroll() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!browserSupportsWebAuthn()) throw new Error("This browser does not support passkeys.");
      const optionsRes = await fetch("/api/passkeys/register/options", { method: "POST" });
      const request = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(request.error || "Could not start passkey enrollment.");
      const response = await startRegistration({ optionsJSON: request.options });
      const verifyRes = await fetch("/api/passkeys/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: request.challengeId, label, response }),
      });
      const result = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(result.error || "Passkey enrollment failed.");
      setMessage("Passkey created. You can use it on the EditForge sign-in screen.");
      await load();
    } catch (err) {
      setError((err as Error).message || "Passkey enrollment was cancelled.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(passkey: PasskeySummary) {
    if (!window.confirm(`Remove ${passkey.label}? The recovery password will still work.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/passkeys/${encodeURIComponent(passkey.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove passkey.");
      setMessage("Passkey removed.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rotateRecoveryPassword(event: React.FormEvent) {
    event.preventDefault();
    setRecoveryError("");
    setRecoveryMessage("");
    if (newPassword !== confirmPassword) {
      setRecoveryError("The recovery passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/access-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not rotate the recovery password.");
      setNewPassword("");
      setConfirmPassword("");
      setRecoveryMessage("Recovery password rotated. Existing passkeys and this session remain valid.");
    } catch (err) {
      setRecoveryError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Access"
        title="Security"
        description="Create a phishing-resistant passkey for EditForge. Your device keeps the private key; the studio stores only the public credential."
      />
      <section className="mt-10 overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card">
        <div className="grid gap-8 p-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">New passkey</p>
            <h2 className="mt-2 text-xl font-semibold text-navy">Use your fingerprint, face, PIN, or nearby device</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-navy/60">
              Enrollment requires this authenticated session. The recovery password remains available if your device is lost.
            </p>
            <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-navy/45">
              Passkey name
              <Input className="mt-1 normal-case tracking-normal" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
            </label>
          </div>
          <Button onClick={() => void enroll()} disabled={busy || !label.trim()}>
            {busy ? "Waiting for device…" : "Create passkey"}
          </Button>
        </div>
        {(message || error) && (
          <p role={error ? "alert" : "status"} className={`border-t px-6 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-border bg-surface-muted text-navy/70"}`}>
            {error || message}
          </p>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Verified devices</p>
            <h2 className="mt-1 text-xl font-semibold text-navy">Your passkeys</h2>
          </div>
          <span className="text-xs text-navy/45">{passkeys.length} of 5</span>
        </div>
        <div className="mt-3 space-y-2">
          {passkeys.length === 0 && (
            <p className="rounded-card border border-dashed border-border p-5 text-sm text-navy/55">No passkey is enrolled yet.</p>
          )}
          {passkeys.map((passkey) => (
            <article key={passkey.id} className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-elevated p-4 shadow-card">
              <div>
                <h3 className="text-sm font-semibold text-navy">{passkey.label}</h3>
                <p className="mt-1 text-xs text-navy/50">
                  Created {new Date(passkey.createdAt).toLocaleDateString()}
                  {passkey.backedUp ? " · Synced" : " · This device"}
                </p>
              </div>
              <button className="min-h-11 rounded-control px-3 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => void remove(passkey)} disabled={busy}>
                Remove
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-card border border-border bg-surface-elevated p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Recovery</p>
        <h2 className="mt-2 text-xl font-semibold text-navy">Rotate recovery password</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-navy/60">
          Use this after signing in with Google or a passkey when the previous password is lost. EditForge stores a salted password verifier, not the replacement password.
        </p>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={rotateRecoveryPassword}>
          <label className="text-xs font-medium uppercase tracking-wide text-navy/45">
            New password
            <Input
              className="mt-1 normal-case tracking-normal"
              type={showRecoveryPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={16}
              maxLength={128}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="text-xs font-medium uppercase tracking-wide text-navy/45">
            Confirm password
            <Input
              className="mt-1 normal-case tracking-normal"
              type={showRecoveryPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={16}
              maxLength={128}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-xs text-navy/60">
            <input type="checkbox" checked={showRecoveryPassword} onChange={(event) => setShowRecoveryPassword(event.target.checked)} />
            Show recovery password
          </label>
          <Button type="submit" disabled={busy || newPassword.length < 16 || confirmPassword.length < 16}>
            {busy ? "Saving…" : "Rotate password"}
          </Button>
        </form>
        {(recoveryMessage || recoveryError) && (
          <p role={recoveryError ? "alert" : "status"} className={`mt-4 rounded-control border px-3 py-2 text-sm ${recoveryError ? "border-red-200 bg-red-50 text-red-800" : "border-border bg-surface-muted text-navy/70"}`}>
            {recoveryError || recoveryMessage}
          </p>
        )}
      </section>
    </main>
  );
}
