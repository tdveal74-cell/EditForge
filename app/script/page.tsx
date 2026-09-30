"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { downloadText } from "@/lib/download";
import { SAMPLE_BEATS, buildScriptBoard, newScriptBeat, type ScriptBeat } from "@/lib/script-board";

export default function ScriptPage() {
  const [beats, setBeats] = useState<ScriptBeat[]>(SAMPLE_BEATS);
  const board = useMemo(() => buildScriptBoard(beats), [beats]);

  function update(i: number, patch: Partial<ScriptBeat>) {
    setBeats((list) => list.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Sample beats"
        description="Edit continuity beats, then download JSON. Not a screenplay tool. Screenplay apps stay external — this is a note layer."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => downloadText("editforge-script-board.json", board, "application/json")}>
              Download beats
            </Button>
            <Button type="button" variant="secondary" onClick={() => setBeats((list) => [...list, newScriptBeat()])}>
              Add beat
            </Button>
          </div>
        }
      />

      <ol className="mt-10 space-y-3">
        {beats.map((b, i) => (
          <li
            key={`${b.scene}-${i}`}
            className="rounded-card border border-border bg-surface-elevated p-4 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="w-20"
                value={b.scene}
                onChange={(e) => update(i, { scene: e.target.value })}
                aria-label={`Scene ${i + 1}`}
              />
              <Input
                className="min-w-[12rem] flex-1 font-semibold"
                value={b.slug}
                onChange={(e) => update(i, { slug: e.target.value })}
                aria-label={`Slug ${i + 1}`}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setBeats((list) => (list.length <= 1 ? list : list.filter((_, idx) => idx !== i)))}
                disabled={beats.length <= 1}
              >
                Remove
              </Button>
            </div>
            <Textarea
              className="mt-2 min-h-[72px]"
              value={b.note}
              onChange={(e) => update(i, { note: e.target.value })}
              aria-label={`Note ${i + 1}`}
            />
            <Input
              className="mt-2"
              value={b.marks.join(", ")}
              onChange={(e) =>
                update(i, { marks: e.target.value.split(",").map((m) => m.trim()).filter(Boolean) })
              }
              aria-label={`Marks ${i + 1}`}
              placeholder="marks, comma separated"
            />
          </li>
        ))}
      </ol>
    </main>
  );
}
