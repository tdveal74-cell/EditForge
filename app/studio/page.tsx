import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HostNotice } from "@/components/HostNotice";
import { MODULE_STATUS_LABEL, MODULE_STATUS_TONE, modulesByDept, workingSurfaces } from "@/lib/studio";
import { PRIMARY_CLIP, REFERENCE_STILL } from "@/lib/mediaLibrary";

export const metadata: Metadata = { title: "Studio" };

const createLanes = [
  { href: "/gen-video", label: "Gen video", note: "Runway wired · others refuse" },
  { href: "/voice", label: "Voice", note: "Clone / TTS with consent" },
  { href: "/avatar", label: "Avatar", note: "HeyGen · talking head" },
  { href: "/stock", label: "Stock", note: "Licensed index" },
  { href: "/dailies", label: "Dailies", note: "Review before assembly" },
  { href: "/review", label: "Review", note: "Frame notes · QC" },
];

export default function StudioPage() {
  const byDept = modulesByDept();
  const ready = workingSurfaces().length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Studio"
        title="Studio"
        description="Create, review, and ship from one surface. Media first. Gates intact. The map below is a directory, not a live status board."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/gen-video">
              <Button type="button" size="sm">
                Generate
              </Button>
            </Link>
            <Link href="/dailies">
              <Button type="button" size="sm" variant="secondary">
                Dailies
              </Button>
            </Link>
          </div>
        }
      />

      <HostNotice />

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">In motion</p>
            <h2 className="mt-1 text-lg font-semibold text-navy">Recent studio media</h2>
          </div>
          <p className="text-xs tabular-nums text-navy/40">{ready} working surfaces</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link
            href="/dailies"
            className="group overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card transition-all duration-flagship ease-flagship hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lifted sm:col-span-2"
          >
            <div className="relative aspect-[9/16] max-h-80 bg-navy/5 sm:aspect-video sm:max-h-none">
              <video
                className="h-full w-full object-cover transition duration-flagship group-hover:opacity-95"
                muted
                playsInline
                preload="metadata"
                poster={REFERENCE_STILL.src}
              >
                <source src={PRIMARY_CLIP.src} type="video/mp4" />
              </video>
            </div>
            <div className="border-t border-border-faint px-4 py-3">
              <p className="text-sm font-medium text-navy">{PRIMARY_CLIP.label}</p>
              <p className="mt-0.5 text-xs text-navy/50">Open in dailies · review before cut</p>
            </div>
          </Link>

          <Link
            href="/color"
            className="group overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card transition-all duration-flagship ease-flagship hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lifted"
          >
            <div className="relative aspect-[4/5] bg-navy/5 sm:aspect-auto sm:min-h-[12rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={REFERENCE_STILL.src}
                alt={REFERENCE_STILL.label}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="border-t border-border-faint px-4 py-3">
              <p className="text-sm font-medium text-navy">Restraint grade</p>
              <p className="mt-0.5 text-xs text-navy/50">Reference frame · color lane</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Create & review</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {createLanes.map((lane) => (
            <Link
              key={lane.href}
              href={lane.href}
              className="flex min-h-11 items-center justify-between gap-3 rounded-card border border-border bg-surface-elevated px-4 py-3.5 shadow-card transition-all duration-flagship ease-flagship hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lifted"
            >
              <div>
                <p className="text-sm font-semibold text-navy">{lane.label}</p>
                <p className="mt-0.5 text-xs text-navy/55">{lane.note}</p>
              </div>
              <span className="text-navy/30" aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/40">Department map</p>
        <p className="mt-1 max-w-xl text-xs text-navy/45">
          Directory of surfaces — not a live status board. Ready means the surface does work (queue, review, export, grade). Board is a sample, sketch, or reference — it may emit a file; it is not an editor. Bridge hands off a file. AI media runs through JobRunner. Ready is never Live.
        </p>
        <div className="mt-4 space-y-6">
          {Object.entries(byDept).map(([dept, mods]) => (
            <div key={dept}>
              <h2 className="flex items-baseline gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-navy/40">
                {dept}
                <span className="tabular-nums text-navy/30">{mods.length}</span>
              </h2>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {mods.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={m.href}
                      className="block rounded-control border border-border-faint bg-surface px-3 py-2.5 transition-colors duration-flagship hover:border-border hover:bg-surface-elevated"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-navy/80">{m.label}</span>
                        <Badge tone={MODULE_STATUS_TONE[m.status]}>{MODULE_STATUS_LABEL[m.status]}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-navy/50">{m.studioRole}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
