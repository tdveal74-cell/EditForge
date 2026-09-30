"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { downloadText } from "@/lib/download";
import { SAMPLE_TITLE_CARDS, buildTitleSpec, newTitleCard, type TitleCard } from "@/lib/titles";
import { PRIMARY_CLIP, REFERENCE_STILL } from "@/lib/mediaLibrary";
import { TitleMotion } from "@/components/media/TitleMotion";

const SIZES = ["text-base", "text-lg", "text-2xl"] as const;

export default function TitlesPage() {
  const [cards, setCards] = useState<TitleCard[]>(SAMPLE_TITLE_CARDS);
  const [activeId, setActiveId] = useState(SAMPLE_TITLE_CARDS[0]?.id ?? "");
  const [persistError, setPersistError] = useState<string | null>(null);
  const spec = useMemo(() => buildTitleSpec(cards), [cards]);
  const active = cards.find((c) => c.id === activeId) ?? cards[0];

  useEffect(() => {
    fetch("/api/titles", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.cards) && d.cards.length) {
          setCards(d.cards);
          setActiveId((prev) => d.cards.some((c: TitleCard) => c.id === prev) ? prev : d.cards[0].id);
        }
      })
      .catch(() => undefined);
  }, []);

  async function persist(next: TitleCard[]) {
    try {
      const res = await fetch("/api/titles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPersistError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      setPersistError(null);
    } catch (err) {
      setPersistError((err as Error).message);
    }
  }

  async function update(id: string, patch: Partial<TitleCard>) {
    const next = cards.map((c) => (c.id === id ? { ...c, ...patch } : c));
    setCards(next);
    setActiveId(id);
    await persist(next);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Title cards"
        description="Type in motion on the frame, then download the spec. Stored. Not After Effects, not a live compositor, not rendered motion graphics."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => downloadText("editforge-titles.json", spec, "application/json")}>
              Download spec
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                const card = newTitleCard();
                const next = [...cards, card];
                setCards(next);
                setActiveId(card.id);
                await persist(next);
              }}
            >
              Add card
            </Button>
          </div>
        }
      />

      {persistError && (
        <p className="mt-4 rounded-control border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not store cards: {persistError}
        </p>
      )}

      {active && (
        <Section title="On the frame">
          <TitleMotion
            text={active.text}
            size={active.size}
            durationSec={active.durationSec}
            src={PRIMARY_CLIP.src}
            poster={REFERENCE_STILL.src}
          />
          <p className="mt-2 text-xs text-navy/45">
            {active.kind} · {active.durationSec}s — CSS / Web Animations on the studio reference clip, not a navy box.
          </p>
        </Section>
      )}

      <ul className="mt-10 space-y-3">
        {cards.map((c) => (
          <li
            key={c.id}
            className={`overflow-hidden rounded-card border bg-surface-elevated shadow-card ${
              c.id === active?.id ? "border-border-strong" : "border-border"
            }`}
          >
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
              <Input
                value={c.kind}
                onChange={(e) => update(c.id, { kind: e.target.value })}
                onFocus={() => setActiveId(c.id)}
                aria-label={`Kind ${c.id}`}
              />
              <Input
                value={c.text}
                onChange={(e) => update(c.id, { text: e.target.value })}
                onFocus={() => setActiveId(c.id)}
                aria-label={`Text ${c.id}`}
              />
              <Input
                value={c.rule}
                onChange={(e) => update(c.id, { rule: e.target.value })}
                onFocus={() => setActiveId(c.id)}
                aria-label={`Rule ${c.id}`}
              />
              <div className="flex gap-2">
                <Input
                  className="w-20"
                  type="number"
                  min={1}
                  step={0.5}
                  value={c.durationSec}
                  onChange={(e) => update(c.id, { durationSec: Number(e.target.value) })}
                  onFocus={() => setActiveId(c.id)}
                  aria-label={`Duration ${c.id}`}
                />
                <select
                  className="w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm text-navy"
                  value={c.size}
                  onChange={(e) => update(c.id, { size: e.target.value })}
                  onFocus={() => setActiveId(c.id)}
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
                  onClick={async () => {
                    if (cards.length <= 1) return;
                    const next = cards.filter((x) => x.id !== c.id);
                    setCards(next);
                    setActiveId(next[0]?.id ?? "");
                    await persist(next);
                  }}
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
