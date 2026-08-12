"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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

  async function load() {
    const res = await fetch("/api/cuts");
    const data = await res.json();
    setCuts(data.cuts || []);
  }

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, []);

  async function addCut(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Projects</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Cuts</h1>
      <p className="mt-2 text-sm text-navy/65">
        Durable store when Redis is configured; otherwise local JSON. Rubric pass required before export jobs.
      </p>

      <form onSubmit={addCut} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input
          className="flex-1 rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm text-navy"
          placeholder="New cut title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Button type="submit">Add cut</Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <ul className="mt-8 space-y-3">
        {cuts.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-card border border-border bg-surface-elevated p-4"
          >
            <div>
              <p className="text-sm font-medium text-navy">{c.title}</p>
              <p className="text-xs text-navy/50">
                {c.id} · {c.status}
                {c.rubricPass ? " · rubric pass" : ""}
              </p>
            </div>
            <Link href="/rubric">
              <Button variant="secondary" type="button">
                Rubric
              </Button>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
