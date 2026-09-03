"use client";

import { useCallback, useEffect, useState } from "react";
import type { StockEntry } from "@/lib/catalog";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

const KINDS = ["music", "sfx", "footage"] as const;

function duration(sec?: number) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

export default function StockPage() {
  const [items, setItems] = useState<StockEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<string>(KINDS[0]);
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState("");
  const [secs, setSecs] = useState("");
  const [licenseNote, setLicenseNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/stock", { cache: "no-store" });
    setItems((await res.json()).stock ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/stock", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(data.stock ?? []))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          mood,
          durationSec: secs ? Number(secs) : undefined,
          licenseNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setTitle("");
      setMood("");
      setSecs("");
      setLicenseNote("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Library"
        title="Stock · Artlist-class"
        description="Music, SFX, and footage index. License terms travel with the asset — an entry cannot be filed without them."
      />

      {/* Library grid first — media product language */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Cleared library</p>
            <h2 className="mt-1 text-lg font-semibold text-navy">What you can actually use</h2>
          </div>
          <p className="text-xs tabular-nums text-navy/40">{(items ?? []).length} filed</p>
        </div>

        {items === null ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-card border border-border bg-surface-muted/50"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-card border border-border-faint bg-surface-muted/40 px-5 py-10 text-center">
            <p className="text-sm text-navy/70">No cleared assets yet.</p>
            <p className="mt-1 text-xs text-navy/50">
              File a licensed entry below. Provider search activates when keys are present.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => (
              <li
                key={s.id}
                className="flex flex-col rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lifted"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-navy">{s.title}</p>
                  <Badge tone="outline">{s.kind}</Badge>
                </div>
                <p className="mt-1 text-xs text-navy/50">{s.mood || "—"}</p>
                {duration(s.durationSec) && (
                  <p className="mt-2 font-mono text-[11px] tabular-nums text-navy/40">
                    {duration(s.durationSec)}
                  </p>
                )}
                <p className="mt-auto border-t border-border-faint pt-3 text-xs leading-relaxed text-navy/65">
                  {s.licenseNote}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* File form — secondary to the library */}
      <section className="mt-12 rounded-card border border-border bg-surface-elevated p-5 shadow-card">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">File a licensed asset</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Label text="Kind">
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </Label>
          </div>
          <div className="min-w-[14rem] flex-1">
            <Label text="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Low pulse bed" />
            </Label>
          </div>
          <div className="w-36">
            <Label text="Mood">
              <Input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="calm · editorial" />
            </Label>
          </div>
          <div className="w-28">
            <Label text="Seconds">
              <Input
                value={secs}
                onChange={(e) => setSecs(e.target.value)}
                inputMode="numeric"
                placeholder="180"
              />
            </Label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[18rem] flex-1">
            <Label text="Licence term (required)">
              <Input
                value={licenseNote}
                onChange={(e) => setLicenseNote(e.target.value)}
                placeholder="Artlist-class: project license required"
              />
            </Label>
          </div>
          <Button
            type="button"
            onClick={add}
            disabled={busy || !title.trim() || !licenseNote.trim()}
            className="mb-0.5"
          >
            File it
          </Button>
        </div>

        <p className="mt-3 text-xs text-navy/45">
          Licence term is required so it reaches archive with the asset. A blank field here is the
          licence being remembered instead of filed.
        </p>
      </section>

      {error && (
        <p className="mt-4 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      <p className="mt-8 text-xs text-navy/45">
        Provider search and licence pull activate when Artlist or Epidemic keys are set on the worker.
        Until then this is the index of what has already been cleared.
      </p>
    </main>
  );
}
