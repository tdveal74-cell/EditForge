"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

function SignIn() {
  const error = useSearchParams().get("error");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">EditForge</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy">Operator sign-in</h1>
      <p className="mt-2 text-sm text-navy/60">
        Sign in with the approved Google account to authorize paid provider work. There is no access password.
      </p>
      {error && <p className="mt-5 rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">Google sign-in was not completed. Try the approved account.</p>}
      <Button className="mt-8 w-full" onClick={() => { window.location.href = "/api/auth/google/start?returnTo=/presenter-broll"; }}>Continue with Google</Button>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><SignIn /></Suspense>;
}
