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

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export default function DailiesPage() {
  const [rolls, setRolls] = useState<LoadState<Roll[]>>({ status: "loading" });
  const [cuts, setCuts] = useState<LoadState<Cut[]>>({ status: "loading" });
  const [cutId, setCutId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dailies", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setRolls({ status: "error", message: data.error ?? `HTTP ${res.status}` });
        return;
      }
      setRolls({ status: "ready", data: data.rolls ?? [] });
    } catch (err) {
      setRolls({ status: "error", message: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/cuts", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setCuts({ status: "error", message: d.error ?? `HTTP ${r.status}` });
          return;
        }
        const list: Cut[] = d.cuts ?? [];
        setCuts({ status: "ready", data: list });
        setCutId((prev) => prev || list[0]?.id || "");
      })
      .catch((err: Error) => setCuts({ status: "error", message: err.message }));
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

  const rollList = rolls.status === "ready" ? rolls.data : [];
  const cutList = cuts.status === "ready" ? cuts.data : [];
  const rollsEmpty = rolls.status === "ready" && rolls.data.length === 0;
  const cutsEmpty = cuts.status === "ready" && cuts.data.length === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Dailies"
        title="Day rolls"
        description="Production review queue — look, note, approve before assembly. A roll enters a cut only once an approval is recorded against it."
      />

      <div className="sr-only" aria-live="polite">
        {rolls.status === "loading" ? "Loading dailies…" : null}
        {rolls.status === "error" ? `Dailies failed to load. ${rolls.message}` : null}
        {rollsEmpty ? "No dailies in the store." : null}
        {cuts.status === "loading" ? "Loading cuts…" : null}
        {cuts.status === "error" ? `Cuts failed to load. ${cuts.message}` : null}
        {cutsEmpty ? "No cuts in the store." : null}
      </div>

      <Section title="Contact sheet" count={rolls.status === "ready" ? rolls.data.length : undefined}>
        <ThumbnailGrid
          shots={rollList.map((r) => ({
            id: r.id,
            label: `${r.camera} · ${r.scenes}`,
            status: r.status,
            poster: r.camera === "A-cam" ? REFERENCE_STILL.src : undefined,
          }))}
        />
      </Section>

      <div className="mt-8 max-w-xs">
        <Label text="Select into cut">
          <Select
            value={cutId}
            onChange={(e) => setCutId(e.target.value)}
            disabled={cuts.status !== "ready" || cutList.length === 0}
          >
            {cuts.status === "loading" && <option value="">Loading cuts…</option>}
            {cuts.status === "error" && <option value="">Cuts failed to load</option>}
            {cutsEmpty && <option value="">No cuts in the store</option>}
            {cutList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Label>
      </div>

      {rolls.status === "error" && (
        <p className="mt-4 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Dailies failed to load. {rolls.message}
        </p>
      )}
      {cuts.status === "error" && (
        <p className="mt-4 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Cuts failed to load. {cuts.message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      {rolls.status === "loading" && (
        <div className="mt-8 space-y-2">
          <p className="text-sm text-navy/55">Loading dailies…</p>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-card border border-border bg-surface-muted/50"
            />
          ))}
        </div>
      )}

      {rollsEmpty && (
        <p className="mt-8 text-sm text-navy/55">No dailies in the store.</p>
      )}

      <ul className="mt-6 space-y-3">
        {rollList.map((r) => {
          const reviewed = r.status === "approved" || r.status === "rejected";
          return (
            <li
              key={r.id}
              className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-medium text-navy">{r.id}</p>
                <StatusLabel tone={toneFor(r.status)}>{r.status}</StatusLabel>
              </div>
              <p className="mt-1 text-xs tabular-nums text-navy/45">
                {r.day} · {r.camera} · scenes {r.scenes}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-navy/70">{r.notes}</p>

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

              <div className="mt-4 space-y-2 border-t border-border-faint pt-4">
                <Input
                  className="h-11 w-full"
                  placeholder={reviewed ? "Change the reason…" : "Reason (optional)"}
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    className="min-h-11 w-full"
                    disabled={busy === r.id}
                    onClick={() =>
                      act(r.id, { action: "review", decision: "approve", note: notes[r.id] })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 w-full"
                    disabled={busy === r.id}
                    onClick={() =>
                      act(r.id, { action: "review", decision: "reject", note: notes[r.id] })
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full"
                    disabled={busy === r.id || !cutId}
                    onClick={() => act(r.id, { action: "select", cutId })}
                  >
                    Select into cut
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-xs text-navy/45">
        Selecting is gated on the server — an unreviewed or rejected roll is refused whatever this
        page sends.
      </p>
    </main>
  );
}
