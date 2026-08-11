export type JobKind = "proxy" | "grade-pass" | "audio-hierarchy" | "export";

export type JobStub = {
  id: string;
  kind: JobKind;
  label: string;
  status: "queued" | "running" | "done" | "blocked";
  note: string;
};

export const JOB_STUBS: JobStub[] = [
  {
    id: "job-proxy",
    kind: "proxy",
    label: "Build edit proxy",
    status: "queued",
    note: "ffmpeg scale + faststart; no look change",
  },
  {
    id: "job-grade",
    kind: "grade-pass",
    label: "Restraint grade pass",
    status: "blocked",
    note: "Requires rubric pass first",
  },
  {
    id: "job-audio",
    kind: "audio-hierarchy",
    label: "Tactile sound hierarchy check",
    status: "queued",
    note: "Loudness + stem presence audit",
  },
  {
    id: "job-export",
    kind: "export",
    label: "Master export",
    status: "blocked",
    note: "Human ship decision after rubric",
  },
];
