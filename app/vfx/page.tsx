import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { StatusLabel, toneFor } from "@/components/ui/status-dot";

export const metadata: Metadata = { title: "VFX board" };

const shots = [
  { id: "VFX_010", desc: "Shadow realm establish", status: "todo", engine: "Fusion / AE external" },
  { id: "VFX_020", desc: "Subtle particulate", status: "wip", engine: "Fusion / AE external" },
  { id: "VFX_030", desc: "End still enhancement", status: "hold", engine: "Restraint only" },
];

export default function VfxPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="VFX"
        title="Shot board"
        description="Tracker only. Heavy comp stays in Fusion, After Effects, or 3D — shot packages cross at /vfx-engine."
      />

      <ul className="mt-10 space-y-2">
        {shots.map((s) => (
          <li
            key={s.id}
            className="rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-semibold text-navy">{s.id}</p>
              <StatusLabel tone={toneFor(s.status)}>{s.status}</StatusLabel>
            </div>
            <p className="mt-1.5 text-sm text-navy/70">{s.desc}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-navy/40">{s.engine}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
