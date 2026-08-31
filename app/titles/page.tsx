"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { downloadText } from "@/lib/download";
import { SAMPLE_TITLE_CARDS, buildTitleSpec, newTitleCard, type TitleCard } from "@/lib/titles";

const SIZES = ["text-base", "text-lg", "text-2xl"] as const;

export default function TitlesPage() {
  const [cards, setCards] = useState<TitleCard[]>(SAMPLE_TITLE_CARDS);
  const spec = useMemo(() => buildTitleSpec(cards), [cards]);

  function update(id: string, patch: Partial<TitleCard>) {
    setCards((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Title cards"
        description="Edit the spec, then download it. Not After Effects, not a live compositor, not rendered motion graphics."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => downloadText("editforge-titles.json", spec, "application/json")}>
              Download spec
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCards((list) => [...list, newTitleCard()])}>
              Add card
            </Button>
          </div>
        }
      />

      <ul className="mt-10 space-y-3">
        {cards.map((c) => (
          <li
            key={c.id}
            className="overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card"
          >
            <div className="flex min-h-24 items-center justify-center border-b border-border-faint bg-navy px-6 py-8">
              <p className={`${c.size} font-semibold tracking-tight text-surface`}>{c.text || "—"}</p>
            </div>
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
              <Input value={c.kind} onChange={(e) => update(c.id, { kind: e.target.value })} aria-label={`Kind ${c.id}`} />
              <Input value={c.text} onChange={(e) => update(c.id, { text: e.target.value })} aria-label={`Text ${c.id}`} />
              <Input value={c.rule} onChange={(e) => update(c.id, { rule: e.target.value })} aria-label={`Rule ${c.id}`} />
              <div className="flex gap-2">
                <Input
                  className="w-20"
                  type="number"
                  min={1}
                  step={0.5}
                  value={c.durationSec}
                  onChange={(e) => update(c.id, { durationSec: Number(e.target.value) })}
                  aria-label={`Duration ${c.id}`}
                />
                <select
                  className="w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm text-navy"
                  value={c.size}
                  onChange={(e) => update(c.id, { size: e.target.value })}
                  aria-label={`Size ${c.id}`}
                >
                  {SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setCards((list) => (list.length <= 1 ? list : list.filter((x) => x.id !== c.id)))}
                  disabled={cards.length <= 1}
                >
                  Remove
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
