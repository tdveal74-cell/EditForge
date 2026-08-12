import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Collaboration" };

const roles = [
  { role: "Director", access: ["Review", "Rubric", "Ship"], note: "Only role that can record a ship decision." },
  { role: "Editor", access: ["Timeline", "Cuts", "Captions"], note: "Owns assembly and the caption lane." },
  { role: "Color", access: ["Grade envelope", "Notes"], note: "Grades inside the envelope; cannot widen it." },
  { role: "Sound", access: ["Hierarchy", "Stems"], note: "Realises the hierarchy, does not renegotiate it." },
  { role: "Producer", access: ["Projects", "Dailies", "Archive"], note: "Moves work through stages; no grade access." },
];

export default function CollabPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Studio"
        title="Collaboration"
        description="Roles for handoff. Access is scoped so the ship decision has exactly one owner — auth wiring lands with the worker increment."
      />

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {roles.map((r) => (
          <Card key={r.role} interactive className="p-4">
            <p className="text-sm font-semibold text-navy">{r.role}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.access.map((a) => (
                <Badge key={a} tone="neutral">
                  {a}
                </Badge>
              ))}
            </div>
            <p className="mt-2.5 border-t border-border-faint pt-2.5 text-xs leading-relaxed text-navy/55">
              {r.note}
            </p>
          </Card>
        ))}
      </div>
    </main>
  );
}
