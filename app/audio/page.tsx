import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/ui/section";
import { Waveform } from "@/components/media/Viewer";
import { DownloadButton } from "@/components/DownloadButton";
import { AUDIO_HIERARCHY, buildAudioLaw } from "@/lib/audio";
import { PRIMARY_CLIP } from "@/lib/mediaLibrary";

export const metadata: Metadata = { title: "Audio hierarchy" };

const hierarchy = AUDIO_HIERARCHY;
const law = buildAudioLaw();

export default function AudioPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Audio ladder"
        description="Sample hierarchy as a file. Not a mixer, not Fairlight, not Essential Sound. Mix realises this law on /mix as a stem sheet."
        actions={
          <DownloadButton filename="editforge-audio-law.json" body={law} mime="application/json">
            Download law
          </DownloadButton>
        }
      />

      <Section title="Attached waveform">
        <Waveform src={PRIMARY_CLIP.src} />
        <p className="mt-2 text-xs text-navy/45">Studio reference clip — not a mix print.</p>
      </Section>

      <ol className="mt-10 space-y-2">
        {hierarchy.map((h) => (
          <li
            key={h.level}
            className="group relative overflow-hidden rounded-card border border-border bg-surface-elevated p-4 shadow-card transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-lifted"
          >
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
