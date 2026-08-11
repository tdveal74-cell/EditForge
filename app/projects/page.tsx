import Link from "next/link";
import { Button } from "@/components/ui/button";

const sample = [
  { id: "cut-01", title: "TSWS E01 cold open", status: "review" },
  { id: "cut-02", title: "Faceless — Authentic Human Teaching", status: "grade" },
  { id: "cut-03", title: "Shorts pack — week 32", status: "ingest" },
];

export default function ProjectsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Projects</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Cuts</h1>
      <p className="mt-2 text-sm text-navy/65">
        Ingest and track cuts. Rubric pass required before ship.
      </p>
      <ul className="mt-8 space-y-3">
        {sample.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-card border border-border bg-surface-elevated p-4"
          >
            <div>
              <p className="text-sm font-medium text-navy">{c.title}</p>
              <p className="text-xs text-navy/50">{c.id} · {c.status}</p>
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
