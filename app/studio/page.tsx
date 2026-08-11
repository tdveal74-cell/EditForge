import Link from "next/link";
import { modulesByDept, type ModuleStatus } from "@/lib/studio";

const statusLabel: Record<ModuleStatus, string> = {
  operational: "Live in EditForge",
  planner: "Board / tracker",
  bridge: "Engine bridge",
  "ai-media": "AI media",
};

export default function StudioPage() {
  const byDept = modulesByDept();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Studio</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Flagship production OS</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/65">
        Every department a serious studio runs. EditForge owns gates, finishing
        discipline, and tracking. Full NLE / 3D / GPU grade stay as engines beside it.
      </p>
      <div className="mt-10 space-y-8">
        {Object.entries(byDept).map(([dept, mods]) => (
          <section key={dept}>
            <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">{dept}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {mods.map((m) => (
                <li key={m.id}>
                  <Link href={m.href} className="block rounded-card border border-border bg-surface-elevated p-4 transition-colors duration-flagship hover:border-border-strong">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-navy">{m.label}</span>
                      <span className="text-[10px] uppercase tracking-wide text-navy/40">{statusLabel[m.status]}</span>
                    </div>
                    <p className="mt-1 text-xs text-navy/60">{m.studioRole}</p>
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
