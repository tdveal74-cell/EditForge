"use client";

import { useState } from "react";
import { GEN_PROVIDERS, GEN_QUALITY_BAR } from "@/lib/genvideo";
import { Button } from "@/components/ui/button";

export default function GenVideoPage() {
  const [provider, setProvider] = useState("runway");
  const [prompt, setPrompt] = useState(
    "Locked wide: empty room, soft window light, dust in air, slow push-in, no faces, cinematic restraint, 24fps feel"
  );
  const [aspect, setAspect] = useState("16:9");
  const [quality, setQuality] = useState("social");
  const [durationSec, setDurationSec] = useState(5);
  const [out, setOut] = useState<string | null>(null);

  async function plan() {
    const res = await fetch("/api/gen-video/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, prompt, aspect, quality, durationSec, mode: "text-to-video" }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">AI Media</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Generative video</h1>
      <p className="mt-2 text-sm text-navy/65">
        Kling · Veo · Runway · Seedream–class quality. EditForge holds the brief and
        quality bar; providers render pixels. Always pass restraint rubric before master.
      </p>
      <label className="mt-6 block text-sm text-navy/70">
        Provider
        <select className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm" value={provider} onChange={(e) => setProvider(e.target.value)}>
          {GEN_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label} — {p.strengths}</option>
          ))}
        </select>
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-navy/70">Aspect
          <select className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm" value={aspect} onChange={(e) => setAspect(e.target.value)}>
            <option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option>
          </select>
        </label>
        <label className="text-sm text-navy/70">Quality
          <select className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm" value={quality} onChange={(e) => setQuality(e.target.value)}>
            <option value="draft">draft</option><option value="social">social</option><option value="broadcast-intent">broadcast-intent</option>
          </select>
        </label>
        <label className="text-sm text-navy/70">Seconds
          <input type="number" min={2} max={30} className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm" value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} />
        </label>
      </div>
      <label className="mt-4 block text-sm text-navy/70">Prompt
        <textarea className="mt-1 min-h-[120px] w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <div className="mt-4"><Button type="button" onClick={plan}>Build gen plan</Button></div>
      {out && <pre className="mt-6 overflow-x-auto rounded-card border border-border bg-navy p-4 text-xs text-surface">{out}</pre>}
      <h2 className="mt-10 text-sm font-semibold text-navy">Quality bar</h2>
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-navy/70">
        {GEN_QUALITY_BAR.map((q) => <li key={q}>{q}</li>)}
      </ul>
    </main>
  );
}
