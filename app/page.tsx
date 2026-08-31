import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LANDING_CAPABILITIES } from "@/lib/landing";
import { STUDIO_MODULES, workingSurfaces } from "@/lib/studio";
import { PRIMARY_CLIP, REFERENCE_STILL, videos } from "@/lib/mediaLibrary";

export default function HomePage() {
  const ready = workingSurfaces().length;
  const aiMedia = STUDIO_MODULES.filter((m) => m.status === "ai-media").length;
  const clipCount = videos().length;

  return (
    <main>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <video
            className="h-full w-full object-cover opacity-[0.22]"
            autoPlay
            muted
            loop
            playsInline
            poster={REFERENCE_STILL.src}
            aria-hidden
          >
            <source src={PRIMARY_CLIP.src} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-surface/40 via-surface/80 to-surface" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-600">
            EditForge · control plane
          </p>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-navy sm:text-5xl md:text-[3.25rem] md:leading-[1.08]">
            Make the cut.
            <span className="mt-1 block text-navy/75">Ship only what earns the rubric.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-navy/70 sm:text-base">
            Post-production control plane for commercials, Shorts, Reels, and long-form.
            Generative lanes, dailies, grade, and delivery — with restraint as house law
            and a human gate before master. Boards are samples. Bridges emit files. Ready is never Live.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/studio">
              <Button type="button" size="lg">
                Enter studio
              </Button>
            </Link>
            <Link href="/gen-video">
              <Button type="button" variant="secondary" size="lg">
                Generate video
              </Button>
            </Link>
            <Link href="/dailies">
              <Button type="button" variant="ghost" size="lg">
                Review dailies
              </Button>
            </Link>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-3">
            {[
              { value: String(ready), label: "Working surfaces" },
              { value: String(aiMedia), label: "AI media lanes" },
              { value: String(clipCount), label: "Studio reels" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-card border border-border-faint bg-surface-elevated px-3 py-3"
              >
                <dd className="text-xl font-semibold tabular-nums text-navy sm:text-2xl">{s.value}</dd>
                <dt className="mt-0.5 text-[10px] uppercase tracking-wide text-navy/45 sm:text-[11px]">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-border/60 bg-surface-muted/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">What you run</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            What is wired, what is a board, what is a file
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LANDING_CAPABILITIES.map((c) => (
              <Link key={c.title} href={c.href} className="group">
                <Card className="h-full p-5 transition-all duration-flagship ease-flagship group-hover:-translate-y-0.5 group-hover:shadow-lifted">
                  <h3 className="text-sm font-semibold text-navy">{c.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-navy/65">{c.body}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Studio media</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-navy">
                Real frames. Real review.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-navy/65">
                Contact sheets, grade references, and players are built against actual
                footage — not empty states. Simulated generations stay labeled. Live
                provider work stays gated.
              </p>
            </div>
            <Link href="/dailies">
              <Button type="button" variant="secondary">
                Open dailies
              </Button>
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card sm:col-span-2">
              <div className="relative flex max-h-[28rem] items-center justify-center bg-navy/5">
                <video
                  className="max-h-[28rem] w-full object-contain"
                  controls
                  playsInline
                  preload="metadata"
                  poster={REFERENCE_STILL.src}
                >
                  <source src={PRIMARY_CLIP.src} type="video/mp4" />
                </video>
              </div>
              <div className="border-t border-border-faint px-4 py-3">
                <p className="text-sm font-medium text-navy">{PRIMARY_CLIP.label}</p>
                <p className="mt-0.5 text-xs text-navy/50">{PRIMARY_CLIP.note}</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card">
              <div className="relative aspect-[4/5] bg-navy/5 sm:aspect-auto sm:h-full sm:min-h-[14rem]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={REFERENCE_STILL.src}
                  alt={REFERENCE_STILL.label}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="border-t border-border-faint px-4 py-3">
                <p className="text-sm font-medium text-navy">{REFERENCE_STILL.label}</p>
                <p className="mt-0.5 text-xs text-navy/50">Grade reference frame</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 bg-surface-muted/30 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">House law</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Restraint is law",
                body: "Amber sparse. Motion short. One accent per view. The grade and the UI obey the same rule.",
              },
              {
                title: "Rubric before master",
                body: "No export leaves without a recorded pass. The gate cannot be skipped silently.",
              },
              {
                title: "Consent for clones",
                body: "Voice and avatar require explicit consent. Simulated media carries mock labels.",
              },
            ].map((p) => (
              <Card key={p.title} className="p-5">
                <h3 className="text-sm font-semibold text-navy">{p.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-navy/65">{p.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
