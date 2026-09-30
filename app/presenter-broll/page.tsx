"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { JobRunner } from "@/components/JobRunner";
import { Label, Select, Textarea } from "@/components/ui/field";
import { providerChoicesFor } from "@/lib/provider-registry";
import {
  PRESENTER_BRANDS,
  PRESENTER_SHOTS,
  presenterPrompt,
  type PresenterBrand,
} from "@/lib/presenterBroll";

const PROVIDERS = providerChoicesFor("gen-video")
  .filter((provider) => provider.id === "runway" || provider.id === "mock")
  .map((provider) => ({ id: provider.id, label: provider.label }));

export default function PresenterBrollPage() {
  const [brand, setBrand] = useState<PresenterBrand>("tqo");
  const [shotId, setShotId] = useState(PRESENTER_SHOTS[0].id);
  const [aspect, setAspect] = useState("16:9");
  const [durationSec, setDurationSec] = useState(5);
  const [motionNotes, setMotionNotes] = useState("");

  const prompt = useMemo(
    () => presenterPrompt({ brand, shotId, motionNotes }),
    [brand, shotId, motionNotes]
  );
  const brandMeta = PRESENTER_BRANDS[brand];
  const shot = PRESENTER_SHOTS.find((item) => item.id === shotId) ?? PRESENTER_SHOTS[0];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Presenter system"
        title="Tee presenter B-roll"
        description="One identity-safe production lane for The Quiet Operator and NCO Forge. EditForge keeps the approved reference private and sends it to Runway only after explicit paid confirmation."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3">
          <div className="rounded-card border border-border bg-surface-elevated p-5 shadow-card">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Current brief</p>
            <h2 className="mt-2 text-xl font-semibold text-navy">{brandMeta.label}</h2>
            <p className="mt-2 text-sm leading-relaxed text-navy/65">{brandMeta.purpose}</p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-control bg-surface-muted p-3">
                <dt className="text-[10px] uppercase tracking-wide text-navy/40">Shot</dt>
                <dd className="mt-1 text-sm font-medium text-navy">{shot.label}</dd>
              </div>
              <div className="rounded-control bg-surface-muted p-3">
                <dt className="text-[10px] uppercase tracking-wide text-navy/40">Frame</dt>
                <dd className="mt-1 text-sm font-medium text-navy">{aspect}</dd>
              </div>
              <div className="rounded-control bg-surface-muted p-3">
                <dt className="text-[10px] uppercase tracking-wide text-navy/40">Length</dt>
                <dd className="mt-1 text-sm font-medium text-navy">{durationSec} seconds</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-card border border-border-faint bg-surface-muted/60 p-5">
            <p className="text-sm font-semibold text-navy">What this lane does</p>
            <p className="mt-2 text-sm leading-relaxed text-navy/65">
              It animates the approved Tee reference as the first frame. That protects identity consistency,
              but it does not invent a completely new wardrobe or location. Use the higher-volume OpenArt
              allowance to build and approve new scene stills first, then spend limited Runway credits only on
              animating the strongest frames.
            </p>
          </div>

          <div className="rounded-card border border-border-faint bg-surface-elevated p-5">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">Prompt receipt</p>
            <p className="mt-3 text-sm leading-relaxed text-navy/70">{prompt}</p>
          </div>
        </section>

        <section className="space-y-4 lg:col-span-2">
          <Label text="Brand">
            <Select value={brand} onChange={(event) => setBrand(event.target.value as PresenterBrand)}>
              <option value="tqo">The Quiet Operator</option>
              <option value="nco-forge">NCO Forge</option>
            </Select>
          </Label>

          <Label text="Shot preset">
            <Select value={shotId} onChange={(event) => setShotId(event.target.value as typeof shotId)}>
              {PRESENTER_SHOTS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </Select>
          </Label>

          <div className="grid grid-cols-2 gap-3">
            <Label text="Aspect">
              <Select value={aspect} onChange={(event) => setAspect(event.target.value)}>
                <option value="16:9">16:9 YouTube</option>
                <option value="9:16">9:16 Shorts</option>
              </Select>
            </Label>
            <Label text="Seconds">
              <Select value={durationSec} onChange={(event) => setDurationSec(Number(event.target.value))}>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
              </Select>
            </Label>
          </div>

          <Label text="Additional motion direction">
            <Textarea
              value={motionNotes}
              onChange={(event) => setMotionNotes(event.target.value)}
              placeholder="Optional: glance down at the notes, then return to the monitor"
              rows={4}
            />
          </Label>

          <JobRunner
            kind="gen-video"
            label={`${brandMeta.label} presenter B-roll: ${shot.label}`}
            prompt={prompt}
            brief={{ brand, shotId, aspect, durationSec, motionNotes }}
            options={{ mode: "image-to-video", model: "gen4.5", aspect, durationSec }}
            providers={PROVIDERS}
          />
        </section>
      </div>
    </main>
  );
}
