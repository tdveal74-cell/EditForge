"use client";

import { useEffect, useMemo, useState } from "react";
import { RESTRAINT_RUBRIC, allRequiredPass } from "@/lib/restraint";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/PageHeader";

type Cut = { id: string; title: string; rubricPass?: boolean };

export default function RubricPage() {
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [cutId, setCutId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pass = useMemo(() => allRequiredPass(results), [results]);
  const checked = RESTRAINT_RUBRIC.filter((c) => results[c.id]).length;

  useEffect(() => {
    fetch("/api/cuts")
      .then((r) => r.json())
      .then((d) => {
        setCuts(d.cuts || []);
        if (d.cuts?.[0]) setCutId(d.cuts[0].id);
      })
      .catch(() => setErr("Could not load cuts"));
  }, []);

  async function savePass() {
    if (!cutId || !pass) return;
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/cuts/${cutId}/rubric`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pass: true }),
    });
    if (!res.ok) {
      setErr("Failed to save rubric pass");
      return;
    }
    setMsg("Rubric pass saved for cut — export plans unlocked");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="QC"
        title="Restraint rubric"
        description="Mark each check only when it is actually true. Every required item must pass before a master can ship — this gate is code, not convention."
        actions={
          <span className="rounded-control border border-border-faint bg-surface-elevated px-3 py-1.5 font-mono text-xs tabular-nums text-navy/60">
            {checked}/{RESTRAINT_RUBRIC.length}
          </span>
        }
      />

      <div className="mt-8 max-w-xl">
        <Label text="Cut">
          {cuts.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-4 py-6 text-sm text-navy/55">
              No cuts in the store yet. Create one on /projects before recording a rubric pass —
              the gate has to attach to a cut.
            </p>
          ) : (
            <Select value={cutId} onChange={(e) => setCutId(e.target.value)}>
              {cuts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          )}
        </Label>
      </div>

      <ul className="mt-6 space-y-2">
        {RESTRAINT_RUBRIC.map((c) => {
          const on = !!results[c.id];
          return (
            <li key={c.id}>
              <label
                className={`flex min-h-[3.25rem] cursor-pointer items-start gap-3 rounded-card border p-4 shadow-card transition-all duration-flagship ease-flagship hover:shadow-lifted ${
                  on
                    ? "border-border-strong bg-surface-elevated"
                    : "border-border bg-surface-elevated/70"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-amber"
                  checked={on}
                  onChange={(e) => setResults((r) => ({ ...r, [c.id]: e.target.checked }))}
                />
                <div>
                  <p className={`text-sm ${on ? "font-medium text-navy" : "text-navy/75"}`}>
                    {c.label}
                  </p>
                  {c.required && (
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-navy/40">
                      Required
                    </p>
                  )}
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          disabled={!pass || !cutId}
          type="button"
          className="min-h-11 w-full sm:w-auto"
          onClick={savePass}
        >
          {pass ? "Save rubric pass" : "Incomplete"}
        </Button>
        <span className="text-sm text-navy/60">
          {pass
            ? "Ready for human ship decision"
            : `${RESTRAINT_RUBRIC.length - checked} check(s) remaining`}
        </span>
      </div>

      {msg && (
        <p className="mt-3 rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm text-navy/80">
          {msg}
        </p>
      )}
      {err && (
        <p className="mt-3 rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </p>
      )}
    </main>
  );
}
