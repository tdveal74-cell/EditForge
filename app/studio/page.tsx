import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { modulesByDept, type ModuleStatus } from "@/lib/studio";

export const metadata: Metadata = { title: "Studio" };

const statusLabel: Record<ModuleStatus, string> = {
  operational: "Live in EditForge",
  planner: "Board / tracker",
  bridge: "Engine bridge",
  "ai-media": "AI media",
};

const statusTone: Record<ModuleStatus, "neutral" | "outline" | "accent" | "quiet"> = {
  operational: "neutral",
  planner: "quiet",
  bridge: "outline",
  "ai-media": "accent",
};

export default function StudioPage() {
  const byDept = modulesByDept();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        eyebrow="Studio"
        title="Flagship production OS"
        description="Full department map. Operational modules, AI media lanes, and engine bridges."
      />
      <div className="mt-10 space-y-8">
        {Object.entries(byDept).map(([dept, mods]) => (
          <section key={dept}>
            <h2 className="flex items-baseline gap-2 text-xs font-medium uppercase tracking-[0.15em] text-navy/45">
              {dept}
              <span className="tabular-nums text-navy/30">{mods.length}</span>
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {mods.map((m) => (
                <li key={m.id}>
                  <Link
                    href={m.href}
                    className="block rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lifted"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-navy">{m.label}</span>
                      <Badge tone={statusTone[m.status]}>{statusLabel[m.status]}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-navy/60">{m.studioRole}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
