"use client";

import { useCallback, useEffect, useState } from "react";
import { SHOT_STATUSES, type ShotStatus, type VfxShot } from "@/lib/vfxShot";
import type { Cut } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { StatusLabel, toneFor } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Section } from "@/components/ui/section";

export default function VfxPage() {
  const [shots, setShots] = useState<VfxShot[] | null>(null);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [id, setId] = useState("");
  const [desc, setDesc] = useState("");
  const [engine, setEngine] = useState("Fusion / AE external");
  const [cutId, setCutId] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/vfx", { cache: "no-store" });
    const data = await res.json();
    setShots(data.shots ?? []);
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

  async function move(shotId: string, status: ShotStatus) {
    setError(null);
    const res = await fetch("/api/vfx", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shotId, status }),
    });
    if (!res.ok) setError((await res.json()).error ?? `HTTP ${res.status}`);
    await load();
  }

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vfx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, desc, engine, cutId: cutId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setId("");
      setDesc("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Shot board"
        description="A shot tracker, not a compositor. Heavy comp stays in Fusion, After Effects, or 3D — the shot package crossing at /vfx-engine carries this board's state."
      />

      <Section title="Add a shot">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-36">
            <Label text="Shot id">
              <Input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="VFX_040"
                // Ids are the conform key between this board, the shot package,
                // and the compositor's filename — so they are uppercased.
                className="font-mono uppercase"
              />
            </Label>
          </div>
          <div className="min-w-[14rem] flex-1">
            <Label text="Description">
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Sky replacement" />
            </Label>
          </div>
          <div className="w-48">
            <Label text="Cut">
              <Select value={cutId} onChange={(e) => setCutId(e.target.value)}>
                <option value="">Unfiled</option>
                {cuts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Label>
          </div>
          <div className="w-48">
            <Label text="Engine">
              <Input value={engine} onChange={(e) => setEngine(e.target.value)} />
            </Label>
          </div>
          <Button type="button" onClick={add} disabled={busy || !id.trim() || !desc.trim()} className="mb-0.5">
            Add
          </Button>
        </div>
      </Section>

      {error && (
        <p className="mt-4 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      {shots === null && (
        <div className="mt-8 space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-card border border-border bg-surface-muted/50" />
          ))}
        </div>
      )}

      <ul className="mt-8 space-y-2">
        {(shots ?? []).map((s) => (
          <li
            key={s.id}
            className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-semibold text-navy">{s.id}</p>
              <StatusLabel tone={toneFor(s.status)}>{s.status}</StatusLabel>
            </div>
            <p className="mt-1.5 text-sm text-navy/70">{s.desc}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] uppercase tracking-wide text-navy/40">
              <span>{s.engine}</span>
              {s.cutId && <span className="font-mono normal-case">{s.cutId}</span>}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border-faint pt-3">
              {SHOT_STATUSES.map((st) => (
                <Button
                  key={st}
                  type="button"
                  size="sm"
                  variant={st === s.status ? "primary" : "ghost"}
                  disabled={st === s.status}
                  onClick={() => move(s.id, st)}
                >
                  {st}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
