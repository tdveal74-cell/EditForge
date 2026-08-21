import { NextResponse } from "next/server";
import { controlRequestAuthorized } from "@/lib/control-auth";
import { artifactIdFromStudioUrl } from "@/lib/forge-worker";
import { cancelJob, completeJob, getJob, pollJob, retryJob } from "@/lib/jobstore";
import {
  getProductionRun,
  setEpisodeProductionStatus,
  setProofGate,
  setThreadMasterAsset,
} from "@/lib/production-store";

async function synchronize(id: string, shouldPoll: boolean) {
  const run = await getProductionRun(id);
  if (!run) return null;
  const current = await getJob(id);
  const job = shouldPoll && current?.status === "running" ? await pollJob(id) : current;
  if (!job) return null;

  if (run.target === "proof") {
    if (job.status === "validating") {
      await setProofGate(run.projectId, {
        status: "validating",
        jobId: job.id,
        artifactId: artifactIdFromStudioUrl(job.result),
      });
    } else if (job.status === "failed" || job.status === "cancelled") {
      await setProofGate(run.projectId, { status: "ready", jobId: job.id, notes: job.error });
    }
  } else if (run.target === "episode" && run.episodeNumber !== undefined) {
    if (job.status === "validating") {
      await setEpisodeProductionStatus(run.projectId, run.episodeNumber, "validating");
    } else if (job.status === "failed" || job.status === "cancelled") {
      await setEpisodeProductionStatus(run.projectId, run.episodeNumber, "assets-ready");
    }
  }
  return { run, job };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await controlRequestAuthorized(req))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const { id } = await params;
  const result = await synchronize(id, true);
  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: "Production run not found" }, { status: 404 });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await controlRequestAuthorized(req))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const run = await getProductionRun(id);
    if (!run) return NextResponse.json({ error: "Production run not found" }, { status: 404 });
    const body = await req.json();
    const action = String(body.action ?? "");
    let job;
    if (action === "poll") job = await pollJob(id);
    else if (action === "retry") job = await retryJob(id);
    else if (action === "cancel") job = await cancelJob(id);
    else if (action === "complete") job = await completeJob(id);
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (action === "complete") {
      const artifactId = artifactIdFromStudioUrl(job.result);
      if (!artifactId) throw new Error("A real worker artifact is required before acceptance");
      if (run.target === "proof") {
        await setProofGate(run.projectId, {
          status: "accepted",
          jobId: job.id,
          artifactId,
          acceptedAt: new Date().toISOString(),
          reviewer: String(body.reviewer ?? "Tee"),
          notes: body.notes ? String(body.notes) : undefined,
        });
      } else if (run.target === "episode" && run.episodeNumber !== undefined) {
        await setEpisodeProductionStatus(run.projectId, run.episodeNumber, "accepted", artifactId);
      } else if (run.target === "thread") {
        await setThreadMasterAsset(run.projectId, artifactId);
      }
    }

    return NextResponse.json({ run, job });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }
}

