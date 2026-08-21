import { NextResponse } from "next/server";
import { controlRequestAuthorized } from "@/lib/control-auth";
import { idempotencyKeyFor } from "@/lib/idempotency";
import { createAndQueue, submitJob } from "@/lib/jobstore";
import type { JobKind } from "@/lib/jobs";
import {
  getProductionProject,
  registerProductionRun,
  setEpisodeProductionStatus,
  setProofGate,
} from "@/lib/production-store";
import {
  generationReadinessFor,
  readinessFor,
  type ProductionProject,
  type ProductionTarget,
} from "@/lib/production";

function proofCharacterMedia(project: ProductionProject) {
  const character = project.characters.find((item) => item.id === project.proofCharacterId);
  if (!character) throw new Error("The configured proof character is missing from the project cast");
  const { identityAssetId, voiceReferenceAssetId, drivingVideoAssetId, consentAssetId } = character.media;
  if (!identityAssetId || !voiceReferenceAssetId || !drivingVideoAssetId || !consentAssetId) {
    throw new Error(`${character.name} needs identity, voice, driving performance, and consent media before a proof render`);
  }
  return { character, identityAssetId, voiceReferenceAssetId, drivingVideoAssetId, consentAssetId };
}

export async function POST(req: Request) {
  if (!(await controlRequestAuthorized(req))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const projectId = String(body.projectId ?? "");
    const target = String(body.target ?? "") as ProductionTarget;
    const workflow = body.workflow === "generate" ? "generate" : "master";
    const episodeNumber = body.episodeNumber === undefined ? undefined : Number(body.episodeNumber);
    if (!["proof", "episode", "thread"].includes(target)) {
      return NextResponse.json({ error: "target must be proof, episode, or thread" }, { status: 400 });
    }

    const project = await getProductionProject(projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const readiness = target === "episode" && workflow === "generate" && episodeNumber !== undefined
      ? generationReadinessFor(project, episodeNumber)
      : readinessFor(project, target, episodeNumber);
    if (!readiness.valid) {
      return NextResponse.json({ error: "Production gate failed", readiness }, { status: 409 });
    }

    let kind: JobKind;
    let label: string;
    let prompt: string;
    let options: Record<string, unknown>;

    if (target === "proof") {
      const proof = proofCharacterMedia(project);
      kind = "proof-shot";
      label = `${project.title} — ${proof.character.name} proof shot`;
      prompt = project.property === "ascension-caudex"
        ? "It won’t wait for us to be ready."
        : `${proof.character.name} performance and identity continuity proof for ${project.threadTitle}.`;
      options = {
        projectId,
        projectTitle: project.title,
        characterName: proof.character.name,
        identityAssetId: proof.identityAssetId,
        voiceReferenceAssetId: proof.voiceReferenceAssetId,
        drivingVideoAssetId: proof.drivingVideoAssetId,
        consentId: proof.consentAssetId,
        output: project.output,
      };
    } else if (target === "episode" && workflow === "generate") {
      const episode = project.episodes.find((item) => item.number === episodeNumber)!;
      kind = "episode-generate";
      label = `${project.title} — Episode ${String(episode.number).padStart(2, "0")} script generation`;
      prompt = `${episode.title}: ${episode.artifact}`;
      options = {
        projectId,
        projectTitle: project.title,
        productionNotes: project.productionNotes ?? [],
        episodeNumber: episode.number,
        durationSec: project.output.episodeDurationSec,
        beats: episode.beats,
        characters: project.characters.map((character) => ({
          id: character.id,
          name: character.name,
          performanceDirection: character.performanceDirection,
          ...character.media,
        })),
        referenceAssetIds: project.characters
          .map((character) => character.media.identityAssetId)
          .filter(Boolean),
        output: project.output,
      };
    } else if (target === "episode") {
      const episode = project.episodes.find((item) => item.number === episodeNumber)!;
      kind = "episode-master";
      label = `${project.title} — Episode ${String(episode.number).padStart(2, "0")} master`;
      prompt = `${episode.title}: ${episode.artifact}`;
      options = {
        projectId,
        episodeNumber: episode.number,
        segmentAssetIds: episode.sourceAssetIds,
        durationSec: project.output.episodeDurationSec,
        output: project.output,
      };
    } else {
      kind = "thread-master";
      label = `${project.title} — ${project.threadTitle} complete master`;
      prompt = `${project.threadTitle} — ${project.output.episodeCount} accepted episode master${project.output.episodeCount === 1 ? "" : "s"} in canonical order`;
      options = {
        projectId,
        episodeAssetIds: project.episodes.map((episode) => episode.masterAssetId),
        expectedCount: project.output.episodeCount,
        episodeDurationSec: project.output.episodeDurationSec,
        totalDurationSec: project.output.episodeDurationSec * project.output.episodeCount,
        output: project.output,
      };
    }

    const key = idempotencyKeyFor(kind, {
      projectId,
      target,
      workflow,
      episodeNumber,
      prompt,
      options,
      updatedAt: project.updatedAt,
    });
    const queued = await createAndQueue({
      kind,
      label,
      note: "Queued for authenticated Forge Worker execution",
      idempotencyKey: key,
    });
    const job = queued.status === "queued"
      ? await submitJob(queued.id, { provider: "forge-worker", prompt, options })
      : queued;
    if (!job) throw new Error("Job disappeared before provider submission");

    const now = new Date().toISOString();
    await registerProductionRun({
      id: job.id,
      projectId,
      target,
      episodeNumber,
      createdAt: now,
      updatedAt: now,
    });
    if (target === "proof") {
      await setProofGate(projectId, { status: job.status === "failed" ? "ready" : "rendering", jobId: job.id });
    } else if (target === "episode" && episodeNumber !== undefined) {
      await setEpisodeProductionStatus(
        projectId,
        episodeNumber,
        job.status === "failed" ? "assets-ready" : "rendering",
      );
    }

    return NextResponse.json({ job, readiness }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
