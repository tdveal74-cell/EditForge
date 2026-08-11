import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">EditForge</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-navy">Flagship production studio OS</h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-navy/70">
        Every department a serious studio runs — editorial, color, sound, captions,
        review, deliverables, archive — with restraint as the house law.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/studio"><Button type="button">Open studio map</Button></Link>
        <Link href="/pipeline"><Button type="button" variant="secondary">Pipeline</Button></Link>
        <Link href="/rubric"><Button type="button" variant="ghost">Rubric</Button></Link>
      </div>
    </main>
  );
}
