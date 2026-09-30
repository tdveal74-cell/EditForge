"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { downloadText } from "@/lib/download";
import { TSWS_PRESETS, buildPresetPack, type LanePreset } from "@/lib/presets";

export default function PresetsPage() {
  const [presets, setPresets] = useState<LanePreset[]>(TSWS_PRESETS);
  const pack = useMemo(() => buildPresetPack(presets), [presets]);

  function update(id: string, patch: Partial<LanePreset>) {
    setPresets((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Lane presets"
        description="Edit restraint notes, then download JSON. A preset constrains the grade — it does not invent a look and is not a live LUT engine."
        actions={
          <Button type="button" onClick={() => downloadText("editforge-presets.json", pack, "application/json")}>
            Download presets
          </Button>
        }
      />

      <div className="mt-10 space-y-3">
        {presets.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Input
                className="max-w-xs font-semibold"
                value={p.name}
                onChange={(e) => update(p.id, { name: e.target.value })}
                aria-label={`Name ${p.id}`}
              />
              <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-navy/45">{p.id}</code>
            </div>
            <Textarea
              className="mt-3 min-h-[72px]"
              value={p.description}
              onChange={(e) => update(p.id, { description: e.target.value })}
              aria-label={`Description ${p.id}`}
            />
            <Textarea
              className="mt-3 min-h-[96px]"
              value={p.restraintNotes.join("\n")}
              onChange={(e) =>
                update(p.id, { restraintNotes: e.target.value.split("\n").map((n) => n.trim()).filter(Boolean) })
              }
              aria-label={`Notes ${p.id}`}
            />
            <p className="mt-2 text-[11px] text-navy/40">One restraint note per line.</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
