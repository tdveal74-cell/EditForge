import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/ui/section";
import { Waveform } from "@/components/media/Viewer";
import { AUDIO_HIERARCHY } from "@/lib/audio";

export const metadata: Metadata = { title: "Audio hierarchy" };

// The ladder lives in lib/audio.ts because /mix generates the stem sheet from
// it. A second copy here could drift, and the mix would receive a rule the
// operator never read.
const hierarchy = AUDIO_HIERARCHY;

export default function AudioPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Sound"
        title="Audio hierarchy"
        description="Fairlight / Essential Sound discipline — tactile, not loud. The ladder is the law: anything lower never competes with anything above it."
      />

      {/* Drawn from real samples when a stem is attached. Nothing is drawn
          from nothing — a picture of sound the operator does not have would
          teach them to distrust the screen. */}
      <Section title="Waveform">
        <Waveform />
      </Section>

      <ol className="mt-10 space-y-2">
        {hierarchy.map((h) => (
          <li
            key={h.level}
            className="group relative overflow-hidden rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
            {/* Bar length encodes priority — loudest claim at the top. */}
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 ${h.weight} bg-surface-muted/70`}
            />
            <div className="relative flex items-baseline gap-3">
              <span className="text-xs font-semibold tabular-nums text-navy/35">{h.level}</span>
              <h2 className="text-sm font-semibold text-navy">{h.name}</h2>
            </div>
            <p className="relative mt-1 pl-7 text-sm text-navy/65">{h.rule}</p>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-xs text-navy/45">
        Stem split and loudness targets cross to the mix stage at{" "}
        <code className="rounded bg-surface-muted px-1 py-0.5">/mix</code>, where this ladder is generated
        into the stem sheet a mixer works from.
      </p>
    </main>
  );
}
