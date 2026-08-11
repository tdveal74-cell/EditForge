"use client";

import { useState } from "react";
import { SAMPLE_AVATARS } from "@/lib/avatar";
import { Button } from "@/components/ui/button";

export default function AvatarPage() {
  const [prompt, setPrompt] = useState(
    "TSWS cold open: calm navy/cream editorial. VO asks 'Where are we today?' Minimal motion. No template chrome."
  );
  const [design, setDesign] = useState("signal");
  const [out, setOut] = useState<string | null>(null);

  async function plan() {
    const res = await fetch("/api/avatar/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, designSource: design }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">AI Media</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Avatar / HyperFrames</h1>
      <p className="mt-2 text-sm text-navy/65">
        HeyGen-class via HyperFrames (compose → status → render). EditForge owns brief, cut link, rubric.
      </p>
      <label className="mt-6 block text-sm text-navy/70">Design source
        <select className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm" value={design} onChange={(e) => setDesign(e.target.value)}>
          <option value="signal">signal</option>
          <option value="monochrome">monochrome</option>
          <option value="claude">claude</option>
          <option value="mat">mat</option>
          <option value="blockframe">blockframe</option>
        </select>
      </label>
      <label className="mt-4 block text-sm text-navy/70">Compose prompt
        <textarea className="mt-1 min-h-[140px] w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <div className="mt-4"><Button type="button" onClick={plan}>Build HyperFrames plan</Button></div>
      {out && <pre className="mt-6 overflow-x-auto rounded-card border border-border bg-navy p-4 text-xs text-surface">{out}</pre>}
      <ul className="mt-8 space-y-2">
        {SAMPLE_AVATARS.map((a) => (
          <li key={a.id} className="rounded-card border border-border bg-surface-elevated px-4 py-3">
            <div className="flex justify-between gap-2">
              <p className="text-sm font-medium text-navy">{a.title}</p>
              <span className="text-xs uppercase text-navy/45">{a.status}</span>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
