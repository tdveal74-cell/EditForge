import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  artifactDir,
  artifactStoreConfigured,
  contentTypeForArtifact,
  isArtifactName,
} from "@/lib/artifacts";
import { createAndQueue, getJob, pollJob, submitJob } from "@/lib/jobstore";
import { findProvider, providerReadiness } from "@/lib/providers";
import { connectedContext, generationNodes, safeAssetUrl } from "./model";
import { getProject, saveProject } from "./server-store";
import type { GraphNode, Project } from "./types";

export type RenderItem = {
  nodeId: string;
  title: string;
  kind: string;
  provider: string;
  prompt: string;
  duration: number;
  aspect: string;
  ready: boolean;
  reason?: string;
  voiceId?: string;
  reference?: string;
};
const providerFor = (n: GraphNode) =>
  n.kind === "image"
    ? "xai-image"
    : n.kind === "voice"
      ? "elevenlabs"
      : "xai-video";
export function renderPlan(p: Project, ids: string[]) {
  if (!ids.length || ids.length > 12 || new Set(ids).size !== ids.length)
    throw new Error("Choose between 1 and 12 unique render nodes.");
  const nodes = generationNodes(p).filter((n) => ids.includes(n.id));
  if (nodes.length !== ids.length)
    throw new Error("Choose still, motion or dialogue nodes to render.");
  const items: RenderItem[] = nodes.map((n) => {
    const provider = providerFor(n);
    const spec = findProvider(provider)!;
    const readiness = providerReadiness(spec, {
      artifactStore: artifactStoreConfigured(),
    });
    const imageParents = p.edges
      .filter((e) => e.to === n.id)
      .map((e) => p.nodes.find((x) => x.id === e.from))
      .filter((x) => x?.kind === "image");
    const reference = n.kind === "video" ? imageParents[0] : undefined;
    let reason: string | undefined;
    if (!readiness.credentialSet)
      reason = `${spec.envKey} is not configured on this server.`;
    else if (
      (spec.wire?.binary || spec.wire?.jsonMedia) &&
      !artifactStoreConfigured()
    )
      reason = "The artifact store is not configured.";
    else if (
      n.kind === "voice" &&
      !n.voiceId &&
      readiness.settingsMissing.length
    )
      reason =
        "Set an authorized ElevenLabs voice ID in the inspector or server settings.";
    if (!n.prompt.trim()) reason = "Add a prompt first.";
    if (n.jobId)
      reason =
        "This version already has a job. Review its receipt, or duplicate the node for a new take.";
    if (
      reference &&
      (!reference.assetUrl ||
        reference.status !== "done" ||
        ids.includes(reference.id))
    )
      reason = "Render and accept the connected reference still first.";
    return {
      nodeId: n.id,
      title: n.title,
      kind: n.kind,
      provider,
      prompt: connectedContext(p, n),
      duration: Math.round(n.duration ?? 6),
      aspect: n.aspectRatio,
      voiceId: n.voiceId,
      reference: reference?.assetUrl,
      ready: !reason,
      reason,
    };
  });
  const confirmation = createHash("sha256")
    .update(JSON.stringify({ project: p.id, revision: p.revision, items }))
    .digest("hex");
  return { items, confirmation, projectId: p.id, revision: p.revision };
}

/** Only read our own public stills/artifacts. Arbitrary paths never reach fs. */
export async function imageReference(url: string): Promise<string> {
  if (!safeAssetUrl(url)) throw new Error("Invalid reference image.");
  if (url.startsWith("https://")) {
    const publicBase = process.env.EDITFORGE_PUBLIC_URL?.replace(/\/$/, "");
    if (publicBase && url.startsWith(`${publicBase}/api/artifacts/`))
      url = url.slice(publicBase.length);
    else return url;
  }
  const name = path.basename(url);
  if (!/\.(jpg|jpeg|png|webp)$/i.test(name))
    throw new Error("Motion needs a still image reference.");
  const root =
    url.startsWith("/api/artifacts/") && isArtifactName(name)
      ? artifactDir()
      : path.join(process.cwd(), "public", path.dirname(url));
  if (!root) throw new Error("Artifact store unavailable.");
  const file = path.join(root, name);
  const stat = await fs.stat(file);
  if (stat.size > 15 * 1024 * 1024) throw new Error("Reference exceeds 15 MB.");
  const bytes = await fs.readFile(file);
  return `data:${contentTypeForArtifact(name)};base64,${bytes.toString("base64")}`;
}

export async function renderNode(
  projectId: string,
  nodeIds: string[],
  confirmation: string,
  voiceConsent: boolean,
) {
  let p = await getProject(projectId);
  if (!p) throw new Error("Saved project not found.");
  const plan = renderPlan(p, nodeIds);
  if (confirmation !== plan.confirmation)
    throw new Error("The graph changed. Review a fresh render confirmation.");
  if (plan.items.some((i) => !i.ready))
    throw new Error(plan.items.find((i) => !i.ready)!.reason);
  if (plan.items.some((i) => i.kind === "voice") && !voiceConsent)
    throw new Error(
      "Confirm that you are authorized to use the selected voice.",
    );
  // Persist every job reference before any paid request. A refresh cannot lose
  // the receipt. Optimistic revision conflicts refuse before provider submit.
  const prepared = await Promise.all(
    plan.items.map(async (item) => {
      const options = {
        aspect: item.aspect,
        duration: item.duration,
        voiceId: item.voiceId,
        ...(item.reference
          ? { imageUrl: await imageReference(item.reference) }
          : {}),
      };
      const idempotencyKey = createHash("sha256")
        .update(`${p!.id}:${item.nodeId}:${plan.confirmation}`)
        .digest("hex")
        .slice(0, 40);
      const job = await createAndQueue({
        kind:
          item.kind === "image"
            ? "gen-image"
            : item.kind === "voice"
              ? "voice"
              : "gen-video",
        label: `${p!.name} · ${item.title}`,
        note: "Confirmed in Canvas",
        idempotencyKey,
      });
      return { item, options, job };
    }),
  );
  p = await saveProject({
    ...p,
    nodes: p.nodes.map((n) => {
      const run = prepared.find((r) => r.item.nodeId === n.id);
      return run
        ? {
            ...n,
            jobId: run.job.id,
            status: "running",
            example: false,
            assetUrl: undefined,
            error: undefined,
          }
        : n;
    }),
  });
  // Sequential submission bounds server load and provider concurrency. Each
  // provider call has its own durable claim inside submitJob.
  for (const run of prepared)
    await submitJob(run.job.id, {
      provider: run.item.provider,
      prompt: run.item.prompt,
      options: run.options,
    });
  return syncJobs(p.id, false);
}

export async function syncJobs(id: string, poll: boolean): Promise<Project> {
  const p = await getProject(id);
  if (!p) throw new Error("Saved project not found.");
  const jobs = await Promise.all(
    p.nodes
      .filter((n) => n.jobId)
      .map((n) => (poll ? pollJob(n.jobId!) : getJob(n.jobId!))),
  );
  const assets = [...p.assets];
  const nodes = p.nodes.map((n): GraphNode => {
    const j = jobs.find((x) => x?.id === n.jobId);
    if (!j) return n;
    const status =
      j.status === "completed"
        ? "done"
        : j.status === "validating"
          ? "validating"
          : j.status === "failed" || j.status === "cancelled"
            ? "error"
            : "running";
    const url = j.result && safeAssetUrl(j.result) ? j.result : undefined;
    const kind =
      n.kind === "voice" ? "audio" : n.kind === "video" ? "video" : "image";
    if (url && !assets.some((a) => a.id === j.id))
      assets.push({
        id: j.id,
        url,
        kind,
        prompt: n.prompt,
        title: n.title,
        createdAt: Date.now(),
        aspectRatio: n.aspectRatio,
      });
    return {
      ...n,
      status,
      assetUrl: url,
      assetKind: kind,
      example: false,
      error:
        j.error ||
        (j.status === "cancelled"
          ? "Tracking stopped. Provider work may still bill."
          : undefined),
    };
  });
  if (
    JSON.stringify(nodes) === JSON.stringify(p.nodes) &&
    assets.length === p.assets.length
  )
    return p;
  return saveProject({ ...p, nodes, assets });
}
