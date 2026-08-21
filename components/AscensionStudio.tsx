"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusLabel, toneFor, toneForJob } from "@/components/ui/status-dot";
import type { ForgeWorkerHealth, WorkerAsset } from "@/lib/forge-worker";
import { generationReadinessFor } from "@/lib/production";
import type {
  AssetRequirement,
  ProductionCharacter,
  ProductionEpisode,
  ProductionProject,
  ProductionTarget,
  ProductionValidation,
} from "@/lib/production";
import type { StudioJob } from "@/lib/jobs";

type ProjectEnvelope = {
  project: ProductionProject;
  validation: ProductionValidation;
  readiness: { proof: ProductionValidation; thread: ProductionValidation };
};

type WorkerEnvelope = { connected: true; health: ForgeWorkerHealth } | { connected: false; error: string };
type RunEnvelope = {
  run: { id: string; projectId: string; target: ProductionTarget; episodeNumber?: number };
  job: StudioJob;
};

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed with HTTP ${response.status}`);
  return body;
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assetFor(project: ProductionProject, requirement: AssetRequirement) {
  return requirement.assetId ? project.assets.find((asset) => asset.id === requirement.assetId) : undefined;
}

function acceptedCount(project: ProductionProject): number {
  return project.episodes.filter((episode) => episode.status === "accepted").length;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(Number.isInteger(seconds) ? 0 : 2)} seconds`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Number((seconds - minutes * 60).toFixed(2));
  return remainder === 0 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : `${minutes}m ${remainder}s`;
}

function EngineRow({ label, ready, detail }: { label: string; ready: boolean; detail?: string }) {
  return (
    <li className="flex items-start justify-between gap-4 border-t border-border-faint py-2 first:border-t-0">
      <span className="text-xs font-medium text-navy/75">{label}</span>
      <span className="text-right text-[11px] text-navy/50">
        <Badge tone={ready ? "accent" : "outline"}>{ready ? "ready" : "blocked"}</Badge>
        {detail ? <span className="mt-1 block max-w-xs">{detail}</span> : null}
      </span>
    </li>
  );
}

export function ProductionStudio({
  initialProject,
  initialWorker,
  initialWorkerError,
}: {
  initialProject: ProductionProject;
  initialWorker: ForgeWorkerHealth | null;
  initialWorkerError: string | null;
}) {
  const [project, setProject] = useState(initialProject);
  const [worker, setWorker] = useState(initialWorker);
  const [workerError, setWorkerError] = useState(initialWorkerError);
  const [runs, setRuns] = useState<Record<string, RunEnvelope>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAscension = project.property === "ascension-caudex";
  const proofCharacter = project.characters.find((character) => character.id === project.proofCharacterId);
  const proofName = proofCharacter?.name ?? "Primary character";
  const collectionLabel = isAscension ? "Thread" : "Microdrama";
  const totalDuration = project.output.episodeDurationSec * project.output.episodeCount;
  const completedCut = project.sourceReferences.find((reference) => reference.role === "completed-cut");
  const sourceClips = project.sourceReferences.filter((reference) => reference.role === "source-clip");
  const consentRequirement = project.requirements.find(
    (item) => item.kind === "consent-record" && item.subjectId === project.proofCharacterId,
  );
  const consentAsset = consentRequirement ? assetFor(project, consentRequirement) : undefined;
  const activeRunIds = useMemo(
    () => Object.values(runs).filter(({ job }) => ["queued", "running"].includes(job.status)).map(({ job }) => job.id),
    [runs],
  );

  const refreshProject = useCallback(async () => {
    const envelope = await responseJson<ProjectEnvelope>(
      await fetch(`/api/production/projects/${project.id}`, { cache: "no-store" }),
    );
    setProject(envelope.project);
    return envelope;
  }, [project.id]);

  const refreshWorker = useCallback(async () => {
    const response = await fetch("/api/production/worker", { cache: "no-store" });
    const envelope = (await response.json()) as WorkerEnvelope;
    if (!response.ok || !envelope.connected) {
      setWorker(null);
      setWorkerError("error" in envelope ? envelope.error : `Worker returned HTTP ${response.status}`);
      return;
    }
    setWorker(envelope.health);
    setWorkerError(null);
  }, []);

  const pollRun = useCallback(async (id: string) => {
    try {
      const envelope = await responseJson<RunEnvelope>(
        await fetch(`/api/production/runs/${encodeURIComponent(id)}`, { cache: "no-store" }),
      );
      setRuns((current) => ({ ...current, [id]: envelope }));
      if (["validating", "failed", "cancelled", "completed"].includes(envelope.job.status)) {
        await refreshProject();
      }
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, [refreshProject]);

  useEffect(() => {
    if (activeRunIds.length === 0) return;
    const timer = window.setInterval(() => {
      for (const id of activeRunIds) void pollRun(id);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeRunIds, pollRun]);

  function clearFeedback() {
    setNotice(null);
    setError(null);
  }

  async function uploadFile(
    file: File,
    kind: string,
    consentId?: string,
  ): Promise<WorkerAsset> {
    const digest = await sha256(file);
    const ticketEnvelope = await responseJson<{ ticket: { uploadUrl: string } }>(
      await fetch("/api/production/upload-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          kind,
          mimeType: file.type || "application/octet-stream",
          maxBytes: file.size,
          sha256: digest,
          consentId,
        }),
      }),
    );
    const uploaded = await responseJson<{ asset: WorkerAsset }>(
      await fetch(ticketEnvelope.ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      }),
    );
    return uploaded.asset;
  }

  async function attachRequirement(requirement: AssetRequirement, file: File) {
    clearFeedback();
    if (requirement.consentRequired && !consentAsset) {
      setError(`Upload the ${proofName} consent record first; protected identity media cannot precede consent.`);
      return;
    }
    setBusy(`requirement:${requirement.id}`);
    try {
      const workerAsset = await uploadFile(
        file,
        requirement.kind,
        requirement.consentRequired ? consentAsset?.workerAssetId : undefined,
      );
      const envelope = await responseJson<{ project: ProductionProject }>(
        await fetch(`/api/production/projects/${project.id}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requirementId: requirement.id, asset: workerAsset }),
        }),
      );
      setProject(envelope.project);
      setNotice(`${requirement.label} uploaded, hashed, and attached.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function attachCharacterFile(
    character: ProductionCharacter,
    role: "identity" | "voice" | "driving" | "consent",
    file: File,
  ) {
    clearFeedback();
    if (role !== "consent" && !character.media.consentAssetId) {
      setError(`Upload ${character.name}'s consent or synthetic-character provenance record first.`);
      return;
    }
    setBusy(`character:${character.id}:${role}`);
    try {
      const kind = {
        identity: "identity-image",
        voice: "voice-reference",
        driving: "driving-video",
        consent: "consent-record",
      }[role];
      const workerAsset = await uploadFile(
        file,
        kind,
        role === "consent" ? undefined : character.media.consentAssetId,
      );
      const envelope = await responseJson<{ project: ProductionProject }>(
        await fetch(`/api/production/projects/${project.id}/characters/${character.id}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, asset: workerAsset }),
        }),
      );
      setProject(envelope.project);
      setNotice(`${character.name} ${role} asset attached with provenance.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function setEpisodeSources(episode: ProductionEpisode, sourceAssetIds: string[]) {
    const envelope = await responseJson<{ project: ProductionProject }>(
      await fetch(`/api/production/projects/${project.id}/episodes/${episode.number}/sources`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceAssetIds }),
      }),
    );
    setProject(envelope.project);
  }

  async function uploadEpisodeSource(episode: ProductionEpisode, file: File) {
    clearFeedback();
    setBusy(`episode-source:${episode.number}`);
    try {
      const workerAsset = await uploadFile(file, "video");
      const registered = await responseJson<{ project: ProductionProject }>(
        await fetch(`/api/production/projects/${project.id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset: workerAsset }),
        }),
      );
      const latestEpisode = registered.project.episodes.find((item) => item.number === episode.number)!;
      await setEpisodeSources(latestEpisode, [...latestEpisode.sourceAssetIds, workerAsset.id]);
      setNotice(`Episode ${episode.number} source ${file.name} uploaded and added to the cut order.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function addProofAsSource(episode: ProductionEpisode) {
    if (!project.proofGate.artifactId) return;
    clearFeedback();
    setBusy(`proof-source:${episode.number}`);
    try {
      await setEpisodeSources(episode, [...episode.sourceAssetIds, project.proofGate.artifactId]);
      setNotice(`Accepted ${proofName} proof shot added to Episode ${episode.number}.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function removeSource(episode: ProductionEpisode, sourceId: string) {
    clearFeedback();
    setBusy(`remove-source:${episode.number}`);
    try {
      await setEpisodeSources(episode, episode.sourceAssetIds.filter((id) => id !== sourceId));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function queueRender(
    target: ProductionTarget,
    episodeNumber?: number,
    workflow: "master" | "generate" = "master",
  ) {
    clearFeedback();
    const key = `${target}:${episodeNumber ?? "all"}:${workflow}`;
    setBusy(key);
    try {
      const envelope = await responseJson<{ job: StudioJob }>(
        await fetch("/api/production/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, target, episodeNumber, workflow }),
        }),
      );
      const run: RunEnvelope = {
        run: { id: envelope.job.id, projectId: project.id, target, episodeNumber },
        job: envelope.job,
      };
      setRuns((current) => ({ ...current, [envelope.job.id]: run }));
      await refreshProject();
      setNotice(`${target === "thread" ? `${collectionLabel} master` : target === "proof" ? `${proofName} proof` : `Episode ${episodeNumber}`} submitted to the Forge Worker.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function acceptRun(envelope: RunEnvelope) {
    clearFeedback();
    setBusy(`accept:${envelope.job.id}`);
    try {
      const accepted = await responseJson<RunEnvelope>(
        await fetch(`/api/production/runs/${encodeURIComponent(envelope.job.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", reviewer: "Tee" }),
        }),
      );
      setRuns((current) => ({ ...current, [envelope.job.id]: accepted }));
      await refreshProject();
      setNotice("Human acceptance recorded. The next production gate is now evaluated against the real artifact.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const engineEntries = worker ? Object.entries(worker.engines) : [];
  const latestRunFor = (target: ProductionTarget, episodeNumber?: number) =>
    Object.values(runs).reverse().find(
      (item) => item.run.target === target && item.run.episodeNumber === episodeNumber,
    );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">{project.title} · {project.threadTitle}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{project.threadTitle} production</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy/65">
            {isAscension
              ? "Devon identity lock, full-motion proof, twelve 90-second vertical episodes, and one combined Thread master. Every clone asset is consent-linked; every master requires human acceptance."
              : "Tee-authored TSWS Microdrama, sourced from the Grok Visuals vertical cut and released before the protected long-form videos. EditForge masters this lane without adapting or changing long-form canon."}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="px-4 py-3">
            <p className="text-xl font-semibold tabular-nums">{acceptedCount(project)}/{project.output.episodeCount}</p>
            <p className="text-[10px] uppercase tracking-wide text-navy/40">Episodes</p>
          </Card>
          <Card className="px-4 py-3">
            <p className="text-xl font-semibold">4K</p>
            <p className="text-[10px] uppercase tracking-wide text-navy/40">2160×3840</p>
          </Card>
          <Card className="px-4 py-3">
            <p className="text-xl font-semibold">$0</p>
            <p className="text-[10px] uppercase tracking-wide text-navy/40">Paid APIs</p>
          </Card>
        </div>
      </div>

      {(notice || error) && (
        <div className={`mt-6 rounded-card border px-4 py-3 text-sm ${error ? "border-red-300 bg-red-50 text-red-800" : "border-border bg-surface-elevated text-navy/70"}`} role={error ? "alert" : "status"}>
          {error ?? notice}
        </div>
      )}

      <section className="mt-10 grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy/40">Compute</p>
              <h2 className="mt-1 text-lg font-semibold">Forge Worker</h2>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => void refreshWorker()}>Check</Button>
          </div>
          {worker ? (
            <ul className="mt-4">
              {engineEntries.map(([name, state]) => (
                <EngineRow key={name} label={name} ready={state.ready} detail={state.detail} />
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-control border border-dashed border-border px-3 py-4 text-xs leading-relaxed text-navy/55">
              <p className="font-medium text-navy/75">Worker not connected</p>
              <p className="mt-1">{workerError ?? "Configure EDITFORGE_WORKER_URL and EDITFORGE_WORKER_TOKEN."}</p>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy/40">Delivery contract</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-control bg-surface-muted/60 p-3">
              <p className="text-xs font-semibold">Episode masters</p>
              <p className="mt-1 text-xs leading-relaxed text-navy/55">{project.output.episodeCount} separate MP4{project.output.episodeCount === 1 ? "" : "s"} · 2160×3840 · 24 fps · stereo 48 kHz · exactly {formatDuration(project.output.episodeDurationSec)} each.</p>
            </div>
            <div className="rounded-control bg-surface-muted/60 p-3">
              <p className="text-xs font-semibold">{collectionLabel} master</p>
              <p className="mt-1 text-xs leading-relaxed text-navy/55">One ordered {formatDuration(totalDuration)} MP4 assembled from all {project.output.episodeCount} accepted episode master{project.output.episodeCount === 1 ? "" : "s"}.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border-faint pt-4">
            <StatusLabel tone={toneFor(project.proofGate.status)}>Proof {project.proofGate.status}</StatusLabel>
            <StatusLabel tone={project.threadMasterAssetId ? "done" : "pending"}>{collectionLabel} {project.threadMasterAssetId ? "mastered" : "not mastered"}</StatusLabel>
          </div>
        </Card>
      </section>

      {project.sourceReferences.length > 0 ? (
        <section className="mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/40">Canonical source registry</p>
              <h2 className="mt-1 text-xl font-semibold">Grok Visuals · TSWS Microdrama only</h2>
              <p className="mt-2 max-w-3xl text-sm text-navy/60">
                Canon authority: {project.canonAuthority}. The loose vertical MP4s are registered in Drive creation order; the completed cut is the accepted continuity reference. Upload that cut into Episode 1 below to place its bytes inside the Forge Worker for 4K mastering.
              </p>
            </div>
            <a
              className="inline-flex items-center justify-center rounded-control border border-border bg-surface-elevated px-3 py-2 text-xs font-medium text-navy hover:border-border-strong"
              href="https://drive.google.com/drive/folders/1F0DnCbnG1PfrAj2BZsNklRKcXhs7J1lb"
              target="_blank"
              rel="noreferrer"
            >
              Open Grok Visuals
            </a>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-navy/40">Source clips</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{sourceClips.length}</p>
              <p className="mt-1 text-xs text-navy/55">Creator-authored vertical shots · reference order locked</p>
            </Card>
            <Card className="p-4 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-navy/40">Completed cut</p>
                  <p className="mt-2 text-sm font-semibold">{completedCut?.label ?? "Not registered"}</p>
                  {completedCut ? (
                    <p className="mt-1 text-xs text-navy/55">{formatDuration(completedCut.durationSec)} · {completedCut.width}×{completedCut.height} · {(completedCut.bytes / 1024 / 1024).toFixed(2)} MB</p>
                  ) : null}
                </div>
                {completedCut ? (
                  <a className="text-xs font-medium text-amber-700 hover:text-amber-800" href={completedCut.url} target="_blank" rel="noreferrer">Open cut in Drive</a>
                ) : null}
              </div>
            </Card>
          </div>
          {project.protectedReferences.map((reference) => (
            <div key={reference.id} className="mt-4 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Long-form boundary locked</p>
              <p className="mt-1 text-xs leading-relaxed">{reference.label}: {reference.reason}</p>
            </div>
          ))}
          <details className="mt-4 rounded-card border border-border bg-surface-elevated p-4">
            <summary className="cursor-pointer text-sm font-medium">View all {project.sourceReferences.length} canonical Drive references</summary>
            <ol className="mt-3 max-h-80 space-y-1 overflow-y-auto border-t border-border-faint pt-3">
              {project.sourceReferences.map((reference) => (
                <li key={reference.id} className="flex items-center gap-3 text-[11px] text-navy/55">
                  <span className="w-6 tabular-nums">{reference.order}.</span>
                  <a className="min-w-0 flex-1 truncate font-mono hover:text-amber-700" href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a>
                  <span>{reference.durationSec.toFixed(3)}s</span>
                  <Badge tone={reference.role === "completed-cut" ? "accent" : "outline"}>{reference.role}</Badge>
                </li>
              ))}
            </ol>
          </details>
        </section>
      ) : null}

      {project.requirements.length > 0 ? (
      <section className="mt-12">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/40">Gate 1</p>
          <h2 className="mt-1 text-xl font-semibold">{proofName} identity and consent</h2>
          <p className="mt-2 text-sm text-navy/60">Upload consent first. EditForge hashes every file and binds the likeness, voice, and driving performance to that worker consent record.</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {project.requirements.map((requirement) => {
            const asset = assetFor(project, requirement);
            const disabled = busy !== null || (requirement.consentRequired && !consentAsset);
            const accept = requirement.kind === "identity-image"
              ? "image/*"
              : requirement.kind === "voice-reference"
                ? "audio/*"
                : requirement.kind === "driving-video"
                  ? "video/*"
                  : ".pdf,image/*,text/plain";
            return (
              <Card key={requirement.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{requirement.label}</p>
                    <p className="mt-1 text-xs text-navy/45">{requirement.consentRequired ? "Protected identity media" : "Authority record"}</p>
                  </div>
                  <Badge tone={asset ? "accent" : "outline"}>{asset ? "attached" : "needed"}</Badge>
                </div>
                {asset ? (
                  <div className="mt-3 rounded-control bg-surface-muted/50 px-3 py-2 text-[11px] text-navy/55">
                    <p className="truncate font-medium text-navy/70">{asset.label}</p>
                    <p className="mt-0.5 font-mono">{asset.sha256.slice(0, 16)}… · {(asset.bytes / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : null}
                <label className={`mt-3 inline-flex cursor-pointer items-center justify-center rounded-control border border-border bg-surface-elevated px-3 py-2 text-xs font-medium ${disabled ? "pointer-events-none opacity-45" : "hover:border-border-strong"}`}>
                  {busy === `requirement:${requirement.id}` ? "Uploading…" : asset ? "Replace file" : "Choose file"}
                  <input
                    className="sr-only"
                    type="file"
                    accept={accept}
                    disabled={disabled}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) void attachRequirement(requirement, file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </Card>
            );
          })}
        </div>
      </section>
      ) : null}

      <section className="mt-12">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/40">Cast automation</p>
          <h2 className="mt-1 text-xl font-semibold">Character performance packs</h2>
          <p className="mt-2 max-w-3xl text-sm text-navy/60">
            {project.requirements.length > 0
              ? `${proofName} is governed by the identity gate above. Add a consent or synthetic-character provenance record, face reference, voice reference, and driving performance for each remaining role to unlock script-to-episode generation.`
              : "The creator-authored completed cut can master without generating new performances. Add consent or synthetic-character provenance, face, voice, and driving references only when you deliberately generate new Auren or Vespera shots."}
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {project.characters.filter((character) => project.requirements.length === 0 || character.id !== project.proofCharacterId).map((character) => {
            const roles = [
              { id: "consent" as const, label: "Consent / provenance", value: character.media.consentAssetId, accept: ".pdf,image/*,text/plain" },
              { id: "identity" as const, label: "Identity image", value: character.media.identityAssetId, accept: "image/*" },
              { id: "voice" as const, label: "Voice reference", value: character.media.voiceReferenceAssetId, accept: "audio/*" },
              { id: "driving" as const, label: "Driving performance", value: character.media.drivingVideoAssetId, accept: "video/*" },
            ];
            const complete = roles.every((role) => Boolean(role.value));
            return (
              <details key={character.id} className="rounded-card border border-border bg-surface-elevated p-4 shadow-card">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-semibold">{character.name}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-navy/50">{character.performanceDirection}</span>
                  </span>
                  <Badge tone={complete ? "accent" : "outline"}>{complete ? "ready" : `${roles.filter((role) => role.value).length}/4`}</Badge>
                </summary>
                <div className="mt-4 grid gap-2 border-t border-border-faint pt-4 sm:grid-cols-2">
                  {roles.map((role) => {
                    const protectedRoleBlocked = role.id !== "consent" && !character.media.consentAssetId;
                    return (
                      <label key={role.id} className={`rounded-control border border-border px-3 py-2 ${busy !== null || protectedRoleBlocked ? "pointer-events-none opacity-45" : "cursor-pointer hover:border-border-strong"}`}>
                        <span className="flex items-center justify-between gap-2 text-xs font-medium">
                          {role.label}
                          <span className="text-[10px] uppercase tracking-wide text-navy/40">{role.value ? "attached" : "add"}</span>
                        </span>
                        {role.value ? <span className="mt-1 block truncate font-mono text-[10px] text-navy/40">{role.value}</span> : null}
                        <input
                          type="file"
                          className="sr-only"
                          accept={role.accept}
                          disabled={busy !== null || protectedRoleBlocked}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            if (file) void attachCharacterFile(character, role.id, file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {project.requirements.length > 0 ? (
      <section className="mt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/40">Gate 2</p>
            <h2 className="mt-1 text-xl font-semibold">Full-motion {proofName} proof</h2>
            <p className="mt-2 max-w-2xl text-sm text-navy/60">One real cloned-voice, portrait-motion, lip-synced 4K shot must survive review before any episode can master.</p>
          </div>
          <Button
            type="button"
            variant="accent"
            disabled={busy !== null || !worker?.readyFor.proofShot || project.proofGate.status === "accepted"}
            onClick={() => void queueRender("proof")}
          >
            {busy === "proof:all:master" ? "Submitting…" : `Render ${proofName} proof`}
          </Button>
        </div>
        {(() => {
          const run = latestRunFor("proof");
          if (!run) return null;
          return (
            <RunReview envelope={run} busy={busy} onPoll={pollRun} onAccept={acceptRun} />
          );
        })()}
      </section>
      ) : null}

      <section className="mt-12">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/40">Gate 3</p>
          <h2 className="mt-1 text-xl font-semibold">Episode{project.output.episodeCount === 1 ? "" : "s"} 1{project.output.episodeCount === 1 ? "" : `–${project.output.episodeCount}`}</h2>
          <p className="mt-2 max-w-3xl text-sm text-navy/60">Add finished full-motion shots in editorial order. The worker normalizes every source to native vertical 4K, assembles the episode, enforces {formatDuration(project.output.episodeDurationSec)}, then holds it for your acceptance.</p>
        </div>
        <div className="mt-5 space-y-3">
          {project.episodes.map((episode) => {
            const run = latestRunFor("episode", episode.number);
            return (
              <Card key={episode.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="outline">E{String(episode.number).padStart(2, "0")}</Badge>
                      <h3 className="text-sm font-semibold">{episode.title}</h3>
                      <StatusLabel tone={toneFor(episode.status)}>{episode.status}</StatusLabel>
                    </div>
                    <p className="mt-2 text-xs text-navy/50">{episode.artifact}</p>
                    <p className="mt-2 text-[11px] text-navy/40">{episode.beats.length} locked beats · {episode.targetDurationSec}s · {episode.sourceAssetIds.length} source{episode.sourceAssetIds.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="accent"
                      disabled={
                        busy !== null ||
                        episode.status === "accepted" ||
                        !worker?.readyFor.episodeGenerate ||
                        !generationReadinessFor(project, episode.number).valid
                      }
                      onClick={() => void queueRender("episode", episode.number, "generate")}
                    >
                      Generate from script
                    </Button>
                    <label className={`inline-flex cursor-pointer items-center rounded-control border border-border px-3 py-2 text-xs font-medium ${busy !== null || project.proofGate.status !== "accepted" ? "pointer-events-none opacity-45" : "hover:border-border-strong"}`}>
                      {busy === `episode-source:${episode.number}` ? "Uploading…" : "Add full-motion clip"}
                      <input
                        className="sr-only"
                        type="file"
                        accept="video/*"
                        disabled={busy !== null || project.proofGate.status !== "accepted"}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) void uploadEpisodeSource(episode, file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {project.proofGate.artifactId && episode.number === 1 && !episode.sourceAssetIds.includes(project.proofGate.artifactId) ? (
                      <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void addProofAsSource(episode)}>Use {proofName} proof</Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== null || project.proofGate.status !== "accepted" || episode.sourceAssetIds.length === 0 || episode.status === "accepted"}
                      onClick={() => void queueRender("episode", episode.number, "master")}
                    >
                      Master episode
                    </Button>
                  </div>
                </div>

                {episode.sourceAssetIds.length > 0 ? (
                  <ol className="mt-4 space-y-1 border-t border-border-faint pt-3">
                    {episode.sourceAssetIds.map((sourceId, index) => (
                      <li key={sourceId} className="flex items-center gap-2 text-[11px] text-navy/50">
                        <span className="w-5 tabular-nums">{index + 1}.</span>
                        <span className="min-w-0 flex-1 truncate font-mono">{sourceId}</span>
                        <Button type="button" size="sm" variant="ghost" disabled={busy !== null || episode.status === "accepted"} onClick={() => void removeSource(episode, sourceId)}>Remove</Button>
                      </li>
                    ))}
                  </ol>
                ) : null}
                {run ? <RunReview envelope={run} busy={busy} onPoll={pollRun} onAccept={acceptRun} compact /> : null}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-12 border-t border-border pt-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/40">Gate 4</p>
            <h2 className="mt-1 text-xl font-semibold">Complete {collectionLabel} master</h2>
            <p className="mt-2 max-w-2xl text-sm text-navy/60">Lossless ordered assembly starts only after all {project.output.episodeCount} 4K episode master{project.output.episodeCount === 1 ? " is" : "s are"} accepted.</p>
          </div>
          <Button
            type="button"
            variant="accent"
            disabled={busy !== null || acceptedCount(project) !== project.output.episodeCount || Boolean(project.threadMasterAssetId)}
            onClick={() => void queueRender("thread")}
          >
            Render {project.output.episodeCount === 1 ? "release master" : `all ${project.output.episodeCount} together`}
          </Button>
        </div>
        {project.threadMasterAssetId ? (
          <Card className="mt-5 overflow-hidden">
            <video className="max-h-[70vh] w-full bg-black" controls playsInline preload="metadata" src={`/api/production/artifacts/${encodeURIComponent(project.threadMasterAssetId)}`} />
            <div className="border-t border-border px-4 py-3 text-xs text-navy/55">Accepted {collectionLabel} master · <span className="font-mono">{project.threadMasterAssetId}</span></div>
          </Card>
        ) : null}
        {(() => {
          const run = latestRunFor("thread");
          return run ? <RunReview envelope={run} busy={busy} onPoll={pollRun} onAccept={acceptRun} /> : null;
        })()}
      </section>
    </main>
  );
}

export const AscensionStudio = ProductionStudio;

function RunReview({
  envelope,
  busy,
  onPoll,
  onAccept,
  compact = false,
}: {
  envelope: RunEnvelope;
  busy: string | null;
  onPoll: (id: string) => Promise<void>;
  onAccept: (run: RunEnvelope) => Promise<void>;
  compact?: boolean;
}) {
  const { job } = envelope;
  return (
    <div className={`${compact ? "mt-4" : "mt-5"} overflow-hidden rounded-card border border-border bg-surface-elevated`}>
      {job.result ? (
        <video className={`${compact ? "max-h-96" : "max-h-[70vh]"} w-full bg-black`} controls playsInline preload="metadata" src={job.result} />
      ) : null}
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <StatusLabel tone={toneForJob(job.status)}>{job.status}</StatusLabel>
          <p className="mt-1 text-xs text-navy/55">{job.error ?? job.note}</p>
        </div>
        <div className="flex gap-2">
          {["running", "queued"].includes(job.status) ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => void onPoll(job.id)}>Check now</Button>
          ) : null}
          {job.status === "validating" && job.result ? (
            <Button type="button" size="sm" variant="accent" disabled={busy === `accept:${job.id}`} onClick={() => void onAccept(envelope)}>
              {busy === `accept:${job.id}` ? "Recording…" : "Accept real master"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
