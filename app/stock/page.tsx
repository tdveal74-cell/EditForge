"use client";

import { useCallback, useEffect, useState } from "react";
import type { StockEntry } from "@/lib/catalog";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Section } from "@/components/ui/section";

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
    void load();
  }, [load]);

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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Library"
        title="Stock · Artlist-class"
        description="Music, SFX, and footage index. License terms travel with the asset — an entry cannot be filed without them."
      />

      <Section title="File a licensed asset">
        <div className="flex flex-wrap items-end gap-3">
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

        <p className="mt-2 text-xs text-navy/45">
          The licence term is required because it has to reach archive with the asset. A blank field here is
          the licence being remembered instead of filed.
        </p>
      </Section>

      {error && (
        <p className="mt-4 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      <ul className="mt-8 space-y-2">
        {(items ?? []).map((s) => (
          <li
            key={s.id}
            className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-navy">{s.title}</p>
              <div className="flex items-center gap-2">
                {duration(s.durationSec) && (
                  <span className="font-mono text-[11px] tabular-nums text-navy/40">
                    {duration(s.durationSec)}
                  </span>
                )}
                <Badge tone="outline">{s.kind}</Badge>
              </div>
            </div>
            <p className="mt-1 text-xs text-navy/50">{s.mood}</p>
            <p className="mt-2 border-t border-border-faint pt-2 text-xs leading-relaxed text-navy/65">
              {s.licenseNote}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-navy/45">
        Provider search and licence pull activate when Artlist or Epidemic keys are set on the worker. Until
        then this is the index of what has already been cleared.
      </p>
    </main>
  );
}
