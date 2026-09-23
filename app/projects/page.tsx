"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { StatusLabel, toneFor } from "@/components/ui/status-dot";
import { PageHeader } from "@/components/PageHeader";

type Cut = {
  id: string;
  title: string;
  status: string;
  rubricPass?: boolean;
};

export default function ProjectsPage() {
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/cuts");
    const data = await res.json();
    setCuts(data.cuts || []);
  }

  useEffect(() => {
    fetch("/api/cuts")
      .then((res) => res.json())
      .then((data) => setCuts(data.cuts || []))
      .catch(() => setError("Could not load cuts"))
      .finally(() => setLoading(false));
  }, []);

  async function addCut(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/cuts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        setError("Could not create cut");
        return;
      }
      setTitle("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Projects"
        title="Cuts"
        description="Durable store when Redis is configured; otherwise local JSON. A rubric pass is required before any export job is authorized."
      />

      <form onSubmit={addCut} className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="New cut title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          aria-label="New cut title"
        />
        <Button type="submit" disabled={saving} className="shrink-0">
          {saving ? "Adding…" : "Add cut"}
        </Button>
      </form>
      {error && (
        <p className="mt-2 rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <ul className="mt-8 space-y-2">
        {loading &&
          [0, 1, 2].map((i) => (
            <li
              key={i}
              aria-hidden
              className="h-[68px] animate-pulse rounded-card border border-border-faint bg-surface-muted/50"
            />
          ))}

        {!loading && cuts.length === 0 && (
          <li className="rounded-card border border-dashed border-border bg-surface-elevated/50 px-4 py-8 text-center text-sm text-navy/45">
            No cuts yet. Add one above to start tracking.
          </li>
        )}

        {cuts.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy">{c.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-[11px] text-navy/35">{c.id}</span>
                <StatusLabel tone={toneFor(c.status)}>{c.status}</StatusLabel>
                {c.rubricPass && (
                  <span className="text-[11px] uppercase tracking-wide text-amber-700">rubric pass</span>
                )}
              </div>
            </div>
            <Link href="/rubric" className="shrink-0">
              <Button variant="secondary" size="sm" type="button">
                Rubric
              </Button>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
