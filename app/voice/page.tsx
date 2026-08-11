"use client";

import { useState } from "react";
import { SAMPLE_VOICES } from "@/lib/voice";
import { Button } from "@/components/ui/button";

export default function VoicePage() {
  const [voiceId, setVoiceId] = useState(SAMPLE_VOICES[0].id);
  const [text, setText] = useState("Where are we today? Inside the question we keep avoiding.");
  const [out, setOut] = useState<string | null>(null);

  async function plan() {
    const res = await fetch("/api/voice/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId, text }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">AI Media</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Voice clone / TTS</h1>
      <p className="mt-2 text-sm text-navy/65">
        ElevenLabs-class VO. Cloned voices require consent + license. Live synthesize needs ELEVENLABS_API_KEY.
      </p>
      <label className="mt-6 block text-sm text-navy/70">Voice
        <select className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
          {SAMPLE_VOICES.map((v) => (
            <option key={v.id} value={v.id}>{v.name} ({v.kind})</option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm text-navy/70">Script
        <textarea className="mt-1 min-h-[120px] w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm text-navy" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="mt-4"><Button type="button" onClick={plan}>Build voice plan</Button></div>
      {out && <pre className="mt-6 overflow-x-auto rounded-card border border-border bg-navy p-4 text-xs text-surface">{out}</pre>}
    </main>
  );
}
