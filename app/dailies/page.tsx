"use client";

import { useCallback, useEffect, useState } from "react";
import type { Roll } from "@/lib/dailies";
import type { Cut } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { StatusLabel, toneFor } from "@/components/ui/status-dot";
import { Section } from "@/components/ui/section";
import { ThumbnailGrid } from "@/components/media/Viewer";
import { REFERENCE_STILL } from "@/lib/mediaLibrary";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

export default function DailiesPage() {
  const [rolls, setRolls] = useState<Roll[] | null>(null);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [cutId, setCutId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/dailies", { cache: "no-store" });
    const data = await res.json();
    setRolls(data.rolls ?? []);
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/cuts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: Cut[] = d.cuts ?? [];
        setCuts(list);
        setCutId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => setCuts([]));
  }, [load]);

  async function act(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/dailies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json();
      // The refusal is the feature. Showing it verbatim is how an operator
      // learns the roll needs review rather than that the button is broken.
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Dailies"
        title="Day rolls"
        description="Production review queue — select, note, approve before assembly. A roll enters a cut only once an approval is recorded against it."
      />

      {/* Dailies are reviewed by looking, not by reading a table. Posters
          appear per roll as media lands; until then each slot says so. */}
      <Section title="Contact sheet" count={rolls?.length}>
        <ThumbnailGrid
          // The seeded A-cam rolls are the ones this footage came off, so they
          // get the real frame; anything ingested later shows its labelled slug
          // until a poster exists for it.
          shots={(rolls ?? []).map((r) => ({
            id: r.id,
            label: `${r.camera} · ${r.scenes}`,
            status: r.status,
            poster: r.camera === "A-cam" ? REFERENCE_STILL.src : undefined,
          }))}
        />
      </Section>

      <div className="mt-8 w-64">
        <Label text="Select into cut">
          <Select value={cutId} onChange={(e) => setCutId(e.target.value)}>
            {cuts.length === 0 && <option value="">No cuts in the store</option>}
            {cuts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Label>
      </div>

      {error && (
        <p className="mt-4 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      {rolls === null && (
        <div className="mt-8 space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-card border border-border bg-surface-muted/50" />
          ))}
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {(rolls ?? []).map((r) => {
          const reviewed = r.status === "approved" || r.status === "rejected";
          return (
            <li
              key={r.id}
              className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-medium text-navy">{r.id}</p>
                <StatusLabel tone={toneFor(r.status)}>{r.status}</StatusLabel>
              </div>
              <p className="mt-1 text-xs tabular-nums text-navy/45">
                {r.day} · {r.camera} · scenes {r.scenes}
              </p>
              <p className="mt-2 text-sm text-navy/70">{r.notes}</p>

              {r.reviewNote && (
                <p className="mt-2 border-l-2 border-border-strong pl-3 text-sm italic text-navy/60">
                  {r.reviewNote}
                </p>
              )}

              {r.selectedForCutId && (
                <p className="mt-2 text-xs text-navy/50">
                  In cut <span className="font-mono">{r.selectedForCutId}</span>
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-faint pt-3">
                <Input
                  className="h-9 min-w-[12rem] flex-1"
                  placeholder={reviewed ? "Change the reason…" : "Reason (optional)"}
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy === r.id}
                  onClick={() => act(r.id, { action: "review", decision: "approve", note: notes[r.id] })}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy === r.id}
                  onClick={() => act(r.id, { action: "review", decision: "reject", note: notes[r.id] })}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy === r.id || !cutId}
                  onClick={() => act(r.id, { action: "select", cutId })}
                >
                  Select into cut
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-xs text-navy/45">
        Selecting is gated on the server, not here — an unreviewed or rejected roll is refused whatever
        this page sends.
      </p>
    </main>
  );
}
