"use client";

import { useMemo, useState } from "react";
import { RESTRAINT_RUBRIC, allRequiredPass } from "@/lib/restraint";
import { Button } from "@/components/ui/button";

export default function RubricPage() {
  const [results, setResults] = useState<Record<string, boolean>>({});
  const pass = useMemo(() => allRequiredPass(results), [results]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">
        EditForge
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Restraint rubric</h1>
      <p className="mt-2 text-sm text-navy/65">
        Mark each check only when true. Required items must all pass before ship.
      </p>
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
              {c.required && (
                <p className="text-xs text-navy/50">Required</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex items-center gap-3">
        <Button disabled={!pass} type="button">
          {pass ? "Rubric pass" : "Incomplete"}
        </Button>
        <span className="text-sm text-navy/60">
          {pass ? "Ready for human ship decision" : "Complete required checks"}
        </span>
      </div>
    </main>
  );
}
