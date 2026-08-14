"use client";

import { useEffect, useState } from "react";
import { DELIVERABLES } from "@/lib/pipeline";
import type { Cut } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Label, Select, Output } from "@/components/ui/field";
import { PageHeader } from "@/components/PageHeader";

export default function ExportPage() {
  const [format, setFormat] = useState(DELIVERABLES[0].id);
  const [cuts, setCuts] = useState<Cut[] | null>(null);
  const [cutId, setCutId] = useState("");
  const [out, setOut] = useState<string | null>(null);
  const isProxy = format === "proxy";

  useEffect(() => {
    fetch("/api/cuts")
      .then((r) => r.json())
      .then((d) => {
        const list: Cut[] = d.cuts ?? [];
        setCuts(list);
        setCutId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => setCuts([]));
  }, []);

  const cut = cuts?.find((c) => c.id === cutId);
  const blocked = !isProxy && !cut?.rubricPass;

  async function plan() {
    const res = await fetch("/api/ffmpeg/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: isProxy ? "proxy" : "export",
        cutId,
        inputPath: "master_src.mp4",
        outputPath: `${format}.mp4`,
      }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Deliverables"
        title="Export"
        description="Resolve deliver + CapCut format matrix. Anything that isn't a proxy needs a recorded rubric pass first — that gate lives on the cut, not on this page."
      />

      <ul className="mt-10 space-y-2">
        {DELIVERABLES.map((d) => {
          const on = format === d.id;
          return (
            <li key={d.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-card border p-4 shadow-card transition-all duration-flagship ease-flagship hover:shadow-lifted ${
                  on
                    ? "border-border-strong bg-surface-elevated"
                    : "border-border bg-surface-elevated/70"
                }`}
              >
                <input
                  type="radio"
                  name="fmt"
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-amber"
                  checked={on}
                  onChange={() => setFormat(d.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p
                      className={`text-sm ${on ? "font-semibold text-navy" : "font-medium text-navy/80"}`}
                    >
                      {d.label}
                    </p>
                    <span className="font-mono text-[11px] tabular-nums text-navy/40">
                      {d.width}×{d.height}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-navy/55">{d.use}</p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        <Label text="Cut to export">
          <Select value={cutId} onChange={(e) => setCutId(e.target.value)} disabled={isProxy}>
            {cuts === null && <option>Loading…</option>}
            {cuts?.length === 0 && <option value="">No cuts in the store</option>}
            {cuts?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — {c.rubricPass ? "rubric passed" : "no rubric pass"}
              </option>
            ))}
          </Select>
        </Label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto"
          onClick={plan}
          disabled={!isProxy && !cutId}
        >
          Build export plan
        </Button>
        {isProxy ? (
          <span className="text-xs text-navy/50">Proxy — ungated by design.</span>
        ) : blocked ? (
          <span className="text-xs text-amber-700">
            {cut
              ? `“${cut.title}” has no recorded rubric pass — record one on /rubric.`
              : "Select a cut."}
          </span>
        ) : (
          <span className="text-xs text-navy/50">
            Authorised by the rubric pass recorded on “{cut?.title}”.
          </span>
        )}
      </div>

      {out && <Output>{out}</Output>}
    </main>
  );
}
