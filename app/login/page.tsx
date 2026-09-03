"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label, Input } from "@/components/ui/field";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        This deployment holds live provider credentials. Sign in to continue.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Label text="Access password">
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Label>

        {error && (
          <p className="rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy || !password} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
