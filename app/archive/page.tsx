import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Archive" };

const checklist = [
  { item: "Master + project archive linked", why: "The master is findable from the cut, not just from a path someone remembers." },
  { item: "Proxies marked disposable or kept", why: "Nobody should have to guess whether a proxy tree is safe to delete." },
  { item: "SFX / music licenses filed", why: "License terms outlive the edit; they belong beside the master." },
  { item: "Caption SRT beside master", why: "Re-cutting later without captions means redoing the pass." },
  { item: "Rubric pass recorded on cut", why: "The ship decision is part of the record, not a memory." },
  { item: "Drive / LTO path documented", why: "3-2-1 only holds if the second and third copies are written down." },
];

export default function ArchivePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Archive"
        title="Cold storage"
        description="Nothing ships to archive without the checklist. Two media types, one geo-separated copy — the 3-2-1 rule is the floor, not the goal."
      />

      <ul className="mt-10 space-y-2">
        {checklist.map((c) => (
          <li
            key={c.item}
            className="flex gap-3 rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong text-[9px] text-navy/40"
            >
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy">{c.item}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-navy/55">{c.why}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-navy/45">
        Storage tiers and retention live in{" "}
        <code className="rounded bg-surface-muted px-1 py-0.5">docs/HARDWARE.md</code>.
      </p>
    </main>
  );
}
