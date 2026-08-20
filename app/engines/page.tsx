import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import {
  capabilitiesFor,
  type CapabilityState,
  type Engine,
} from "@/lib/engine-capabilities";
import { spendPolicyFromEnv } from "@/lib/spend-policy";

export const dynamic = "force-dynamic";

const ENGINES: readonly {
  id: Engine;
  name: string;
  purpose: string;
}[] = [
  {
    id: "persona",
    name: "Persona Engine",
    purpose: "Consented voices, digital twins, performance transfer, transcription and lip sync.",
  },
  {
    id: "cinema",
    name: "Cinema Engine",
    purpose: "Kling-class shot planning, reference consistency, motion control and generative video.",
  },
  {
    id: "edit",
    name: "Edit Engine",
    purpose: "Runway-class transformation, timeline assembly, captions, compositing and 4K masters.",
  },
] as const;

const STATE_LABELS: Record<CapabilityState, string> = {
  "ready-local": "Ready locally",
  "adapter-ready": "Adapter ready",
  "gpu-required": "GPU required",
  "disabled-paid": "Paid path disabled",
};

export default function EnginesPage() {
  const policy = spendPolicyFromEnv();
  const remaining = Math.max(0, policy.totalBudgetUsd - policy.spentUsd);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Execution Control"
        title="Persona · Cinema · Edit"
        description="One control plane for digital twins, cinematic generation and generative editing. Free software and paid services stay visibly separate."
      />

      <section
        aria-label="Spend policy"
        className="mt-8 grid gap-3 rounded-card border border-border-strong bg-surface-elevated p-5 shadow-card sm:grid-cols-4"
      >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-navy/45">Mode</p>
          <p className="mt-1 text-sm font-semibold text-navy">{policy.mode}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-navy/45">Billing</p>
          <p className="mt-1 text-sm font-semibold text-navy">
            {policy.billingEnabled ? "Explicitly enabled" : "Disabled"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-navy/45">Remaining budget</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-navy">${remaining.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-navy/45">Paid calls</p>
          <p className="mt-1 text-sm font-semibold text-navy">
            {policy.mode === "zero-cost" ? "Hard blocked" : "Preflight required"}
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {ENGINES.map((engine) => (
          <section key={engine.id} aria-labelledby={`${engine.id}-title`}>
            <Card className="h-full p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-navy/45">
                {engine.id}
              </p>
              <h2 id={`${engine.id}-title`} className="mt-2 text-lg font-semibold tracking-tight text-navy">
                {engine.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-navy/65">{engine.purpose}</p>

              <ul className="mt-5 space-y-4">
                {capabilitiesFor(engine.id).map((capability) => (
                  <li key={`${engine.id}-${capability.provider}`} className="border-t border-border-faint pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-navy">{capability.label}</p>
                      <span className="shrink-0 rounded-pill bg-surface-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-navy/60">
                        {STATE_LABELS[capability.state]}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-navy/60">
                      {capability.functions.join(" · ")}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-navy/45">{capability.honestLimit}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </main>
  );
}

