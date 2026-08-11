"use client";

import { useEffect, useMemo, useState } from "react";
import { RESTRAINT_RUBRIC, allRequiredPass } from "@/lib/restraint";
import { Button } from "@/components/ui/button";

type Cut = { id: string; title: string; rubricPass?: boolean };

export default function RubricPage() {
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [cutId, setCutId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const pass = useMemo(() => allRequiredPass(results), [results]);

  useEffect(() => {
    fetch("/api/cuts")
      .then((r) => r.json())
      .then((d) => {
        setCuts(d.cuts || []);
        if (d.cuts?.[0]) setCutId(d.cuts[0].id);
      })
      .catch(() => setMsg("Could not load cuts"));
  }, []);

  async function savePass() {
    if (!cutId || !pass) return;
    setMsg(null);
    const res = await fetch(`/api/cuts/${cutId}/rubric`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pass: true }),
    });
    if (!res.ok) {
      setMsg("Failed to save rubric pass");
      return;
    }
    setMsg("Rubric pass saved for cut — export plans unlocked");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">EditForge</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Restraint rubric</h1>
      <p className="mt-2 text-sm text-navy/65">
        Mark each check only when true. Required items must all pass before ship.
      </p>

      <label className="mt-6 block text-sm text-navy/70">
        Cut
        <select
          className="mt-1 w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm text-navy"
          value={cutId}
          onChange={(e) => setCutId(e.target.value)}
        >
          {cuts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>

      <ul className="mt-8 space-y-3">
        {RESTRAINT_RUBRIC.map((c) => (
          <li
            key={c.id}
            className="flex items-start gap-3 rounded-card border border-border bg-surface-elevated p-4"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-amber"
              checked={!!results[c.id]}
              onChange={(e) =>
                setResults((r) => ({ ...r, [c.id]: e.target.checked }))
              }
            />
            <div>
              <p className="text-sm font-medium text-navy">{c.label}</p>
              {c.required && <p className="text-xs text-navy/50">Required</p>}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button disabled={!pass || !cutId} type="button" onClick={savePass}>
          {pass ? "Save rubric pass" : "Incomplete"}
        </Button>
        <span className="text-sm text-navy/60">
          {pass ? "Ready for human ship decision" : "Complete required checks"}
        </span>
      </div>
      {msg && <p className="mt-3 text-sm text-navy/80">{msg}</p>}
    </main>
  );
}
