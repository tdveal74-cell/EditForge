import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type BridgeSpec = {
  title: string;
  description: string;
  /** What leaves EditForge, and in what shape. */
  handoff: { label: string; detail: string }[];
  /** Named engines this bridge targets. */
  engines: string[];
};

/**
 * Every engine bridge is the same contract with different nouns: EditForge holds
 * the decision, the engine holds the pixels. One component so the five bridges
 * stay honest about that instead of drifting into five near-identical pages.
 */
const LAW = [
  "EditForge owns project ID, rubric, and the ship decision",
  "The engine owns pixels, GPU, and realtime playback",
  "No silent auto-ship across this bridge",
] as const;

export function BridgePanel({ spec }: { spec: BridgeSpec }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader eyebrow="Bridge" title={spec.title} description={spec.description} />

      <Section title="Engines" count={spec.engines.length}>
        <div className="flex flex-wrap gap-2">
          {spec.engines.map((e) => (
            <Badge key={e} tone="outline">
              {e}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Handoff">
        <dl className="grid gap-3 sm:grid-cols-2">
          {spec.handoff.map((h) => (
            <Card key={h.label} className="p-4">
              <dt className="text-sm font-semibold text-navy">{h.label}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-navy/65">{h.detail}</dd>
            </Card>
          ))}
        </dl>
      </Section>

      <Section title="Boundary law">
        <ul className="space-y-2">
          {LAW.map((l) => (
            <li
              key={l}
              className="flex gap-3 rounded-card border border-border-faint bg-surface-elevated/60 px-4 py-2.5 text-sm text-navy/75"
            >
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-navy/30" />
              {l}
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
