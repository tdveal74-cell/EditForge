"use client";

import { useCallback, useEffect, useState } from "react";
import { ASSET_TYPES, type Asset } from "@/lib/asset";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Section } from "@/components/ui/section";

const glyph: Record<string, string> = {
  video: "▶",
  audio: "⌁",
  image: "▣",
  project: "◆",
  document: "▤",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState<string>(ASSET_TYPES[0]);
  const [tags, setTags] = useState("");
  const [location, setLocation] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/assets", { cache: "no-store" });
    setAssets((await res.json()).assets ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          location,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setName("");
      setTags("");
      setLocation("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  // An index nobody can search is a list. Matching name and tags together is
  // what people actually type into one.
  const q = query.trim().toLowerCase();
  const shown = (assets ?? []).filter(
    (a) => !q || a.name.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q))
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="MAM"
        title="Assets"
        description="The catalog surface. Bytes live on Drive, S3, or Frame.io behind /mam — this is the index that knows where."
      />

      <Section title="Add to the index">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Label text="Filename">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="TSWS_E01_B_cam.mov"
                className="font-mono"
              />
            </Label>
          </div>
          <div className="w-36">
            <Label text="Type">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Label>
          </div>
          <div className="w-44">
            <Label text="Tags">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="master, e01" />
            </Label>
          </div>
          <div className="min-w-[12rem] flex-1">
            <Label text="Location">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="online/cut-01/…"
                className="font-mono"
              />
            </Label>
          </div>
          <Button type="button" onClick={add} disabled={busy || !name.trim()} className="mb-0.5">
            Add
          </Button>
        </div>
        <p className="mt-2 text-xs text-navy/45">
          Paths follow the contract on <code className="rounded bg-surface-muted px-1">/mam</code>.
        </p>
      </Section>

      {error && (
        <p className="mt-4 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      <div className="mt-8">
        <Label text="Search">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="name or tag" />
        </Label>
      </div>

      {shown.length === 0 && assets !== null && (
        <p className="mt-4 rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-navy/45">
          {q ? `Nothing in the index matches “${query}”.` : "The index is empty."}
        </p>
      )}

      <ul className="mt-4 divide-y divide-border-faint overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card">
        {shown.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 px-4 py-3 transition-colors duration-flagship hover:bg-surface-muted/50"
          >
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-control bg-surface-muted text-xs text-navy/45"
            >
              {glyph[a.type] ?? "•"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs text-navy">{a.name}</p>
              {a.location && <p className="truncate font-mono text-[11px] text-navy/40">{a.location}</p>}
            </div>
            <div className="hidden shrink-0 gap-1.5 sm:flex">
              {a.tags.map((t) => (
                <Badge key={t} tone="neutral">
                  {t}
                </Badge>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
