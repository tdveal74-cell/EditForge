import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { STUDIO_MODULES } from "@/lib/studio";

const principles = [
  {
    title: "Restraint is house law",
    body: "Amber sparse, motion 120–240ms, one accent per view. The grade envelope and the UI obey the same rule.",
  },
  {
    title: "Rubric before master",
    body: "No export leaves the building without a rubric pass recorded against the cut. The gate cannot be skipped silently.",
  },
  {
    title: "Consent for clones",
    body: "Voice and avatar lanes require explicit consent records. Simulated media carries mock/AI labels.",
  },
];

export default function HomePage() {
  const depts = new Set(STUDIO_MODULES.map((m) => m.dept)).size;
  const operational = STUDIO_MODULES.filter((m) => m.status === "operational").length;
  const stats = [
    { value: String(depts), label: "Departments" },
    { value: String(STUDIO_MODULES.length), label: "Modules" },
    { value: String(operational), label: "Operational" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-600">EditForge</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-navy sm:text-5xl">
          Flagship production studio OS
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-navy/70">
          Every department a serious studio runs — editorial, color, sound, captions, review,
          deliverables, archive — plus AI media lanes and engine bridges, with restraint as the
          house law.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/studio">
            <Button type="button" size="lg">Open studio map</Button>
          </Link>
          <Link href="/pipeline">
            <Button type="button" variant="secondary" size="lg">Pipeline</Button>
          </Link>
          <Link href="/hardware">
            <Button type="button" variant="ghost" size="lg">Hardware</Button>
          </Link>
        </div>
      </div>

      <dl className="mt-14 grid max-w-xl grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card border border-border-faint bg-surface-elevated/60 px-4 py-3">
            <dd className="text-2xl font-semibold tabular-nums text-navy">{s.value}</dd>
            <dt className="mt-0.5 text-[11px] uppercase tracking-wide text-navy/45">{s.label}</dt>
          </div>
        ))}
      </dl>

      <section className="mt-14">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">House law</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {principles.map((p) => (
            <Card key={p.title} className="p-5">
              <h3 className="text-sm font-semibold text-navy">{p.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-navy/65">{p.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
