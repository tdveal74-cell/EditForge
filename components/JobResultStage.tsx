"use client";

import type { StudioJob } from "@/lib/jobs";
import { isPlayableAudio, isPlayableVideo } from "@/lib/media";
import { Badge } from "@/components/ui/badge";
import { StatusDot, toneForJob } from "@/components/ui/status-dot";

export type StageKind = "video" | "audio" | "visual";

type Props = {
  job: StudioJob | null;
  kind: StageKind;
  emptyTitle: string;
  emptyBody: string;
};

const SETTLED = new Set(["completed", "validating"]);
const TRACKING = new Set(["planned", "authorized", "queued", "running"]);

/**
 * The one result well for gen-video / voice / avatar.
 *
 * Empty until a job exists. Mock stays labeled and produces no media.
 * Live media appears only when the job has a playable result.
 * Studio reference clips do not live here.
 */
export function JobResultStage({ job, kind, emptyTitle, emptyBody }: Props) {
  const settled = job ? SETTLED.has(job.status) : false;
  const tracking = job ? TRACKING.has(job.status) : false;
  const playableAudio = Boolean(job?.result && isPlayableAudio(job.result));
  const playableVideo = Boolean(job?.result && isPlayableVideo(job.result));

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card">
      <div
        className={
          kind === "video"
            ? "relative flex min-h-[14rem] flex-col items-center justify-center bg-navy/5 px-4 py-10"
            : "flex min-h-[14rem] flex-col items-center justify-center bg-navy/[0.03] px-4 py-10"
        }
      >
        {!job && (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">{emptyTitle}</p>
            <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-navy/65">{emptyBody}</p>
          </>
        )}

        {job && tracking && (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">{job.status}</p>
            <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-navy/65">
              {job.mode === "live"
                ? "Live provider is working. Media appears here when it returns a file."
                : "Mock run in progress — the lifecycle is real, no media will appear."}
            </p>
          </>
        )}

        {job && settled && playableAudio && (
          <audio className="w-full max-w-md" controls preload="metadata" src={job.result} />
        )}

        {job && settled && playableVideo && (
          <video
            className="max-h-64 w-full max-w-md rounded-control bg-navy/5 object-contain"
            controls
            preload="metadata"
            src={job.result}
          />
        )}

        {job && settled && job.result && !playableAudio && !playableVideo && (
          <a
            href={job.result}
            target="_blank"
            rel="noreferrer"
            className="max-w-full break-all font-mono text-xs text-navy underline underline-offset-2"
          >
            {job.result}
          </a>
        )}

        {job && settled && !job.result && (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy/45">
              {job.status === "validating" ? "Awaiting human accept" : "Lifecycle complete"}
            </p>
            <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-navy/65">
              {job.mode === "mock"
                ? "Mock path — no media file was produced. The job record is real."
                : "Provider finished. Open the result when a URL is present."}
            </p>
          </>
        )}

        {job?.status === "failed" && (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-red-700">Failed</p>
            <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-navy/65">
              {job.error ?? "The run failed. Retry from the brief if the cause is fixed."}
            </p>
          </>
        )}

        {job?.status === "cancelled" && (
          <p className="text-sm text-navy/65">Cancelled. Nothing was produced.</p>
        )}
      </div>

      <div className="border-t border-border-faint px-4 py-3">
        {job ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusDot tone={toneForJob(job.status)} />
            <span className="text-sm font-medium text-navy">{job.status}</span>
            {job.mode && (
              <Badge tone={job.mode === "live" ? "accent" : "outline"}>
                {job.mode === "live" ? "live provider" : "mock"}
              </Badge>
            )}
            {job.result && (
              <a
                href={job.result}
                target="_blank"
                rel="noreferrer"
                className="ml-auto max-w-[12rem] truncate font-mono text-[10px] text-navy/40 underline underline-offset-2"
              >
                {job.result}
              </a>
            )}
          </div>
        ) : (
          <p className="text-xs text-navy/50">
            One stage. Mock stays mock. Live stays gated. No studio reference clip as output.
          </p>
        )}
      </div>
    </div>
  );
}

export function stageKindForJob(kind: string): StageKind {
  if (kind === "voice") return "audio";
  if (kind === "gen-video" || kind === "avatar") return "video";
  return "visual";
}
