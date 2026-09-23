"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { JobRunner } from "@/components/JobRunner";
import { Label, Input, Textarea } from "@/components/ui/field";

const HYPERFRAMES_PROVIDER = [{ id: "hyperframes-local", label: "HyperFrames (local render)" }];

export default function HyperFramesPage() {
  const [project, setProject] = useState("hyperframes-smoke");
  const [note, setNote] = useState("Render the current approved HyperFrames composition.");
  const validProject = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(project);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Local render"
        title="HyperFrames"
        description="Render an approved project on this VPS. One render runs at a time, and completed MP4 files return to EditForge as playable artifacts."
      />

      <section className="mt-10 space-y-4 rounded-card border border-border bg-surface-elevated p-5 shadow-card">
        <Label text="Project slug">
          <Input value={project} onChange={(event) => setProject(event.target.value)} />
        </Label>
        <p className="text-xs text-navy/50">
          Projects are restricted to <code>/opt/hyperframes-projects/&lt;slug&gt;</code>. Arbitrary paths are refused.
        </p>
        <Label text="Render note">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
        </Label>

        <JobRunner
          kind="gen-video"
          label={`HyperFrames render: ${project}`}
          prompt={note}
          brief={{ project, note }}
          options={{ project }}
          providers={HYPERFRAMES_PROVIDER}
          blockedReason={validProject ? undefined : "Use letters, numbers, dots, underscores, or hyphens for the project slug."}
        />
      </section>
    </main>
  );
}
