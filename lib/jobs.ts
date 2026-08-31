/**
 * Durable job lifecycle for the control plane.
 * States: planned → authorized → queued → running → validating → completed | failed | cancelled
 */

export type JobKind =
  | "proxy"
  | "grade-pass"
  | "audio-hierarchy"
  | "export"
  | "gen-video"
  | "voice"
  | "avatar";

export type JobStatus =
  | "planned"
  | "authorized"
  | "queued"
  | "running"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled";

export type RubricDecision = {
  cutHash: string;
  rubricVersion: string;
  reviewer: string;
  passed: boolean;
  decidedAt: string; // ISO
  notes?: string;
};

export type StudioJob = {
  id: string;
  kind: JobKind;
  label: string;
  status: JobStatus;
  note: string;
  idempotencyKey: string;
  requiresRubricPass: boolean;
  rubricDecision?: RubricDecision;
  /** Which provider took the work, and whether it was a real call. */
  provider?: string;
  mode?: "mock" | "live";
  /** The provider's own id for this work — what a poll is issued against. */
  externalId?: string;
  /** Terminal output once validated, e.g. a rendered asset URL. */
  result?: string;
  /** Why it failed, kept so a retry has something to act on. */
  error?: string;
  /** Submit attempts made; retries after a failure increment this. */
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED: Record<JobStatus, readonly JobStatus[]> = {
  planned: ["authorized", "cancelled"],
  authorized: ["queued", "cancelled"],
  // A submit that never reaches the provider fails from queued — without this
  // edge a rejected submit would have to be laundered through `running`, which
  // would be a lie about what actually happened.
  queued: ["running", "failed", "cancelled"],
  running: ["validating", "failed", "cancelled"],
  validating: ["completed", "failed"],
  completed: [],
  failed: ["queued", "cancelled"],
  cancelled: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransitionJob(from, to)) {
    throw new Error(`Illegal job transition: ${from} → ${to}`);
  }
}

export function createJob(input: {
  id: string;
  kind: JobKind;
  label: string;
  note: string;
  idempotencyKey: string;
  requiresRubricPass?: boolean;
}): StudioJob {
  const now = new Date().toISOString();
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    status: "planned",
    note: input.note,
    idempotencyKey: input.idempotencyKey,
    requiresRubricPass: input.requiresRubricPass ?? false,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Terminal states: nothing further will happen to the job on its own. */
export function isTerminal(status: JobStatus): boolean {
  return ALLOWED[status].length === 0;
}

export function authorizeJob(job: StudioJob, decision?: RubricDecision): StudioJob {
  if (job.requiresRubricPass) {
    if (!decision || !decision.passed) {
      throw new Error("Rubric pass decision required before authorize");
    }
    if (!decision.cutHash || !decision.rubricVersion || !decision.reviewer || !decision.decidedAt) {
      throw new Error("Rubric decision must include cutHash, rubricVersion, reviewer, decidedAt");
    }
  }
  assertJobTransition(job.status, "authorized");
  return {
    ...job,
    status: "authorized",
    rubricDecision: decision ?? job.rubricDecision,
    updatedAt: new Date().toISOString(),
  };
}

export function advanceJob(job: StudioJob, to: JobStatus): StudioJob {
  assertJobTransition(job.status, to);
  return { ...job, status: to, updatedAt: new Date().toISOString() };
}

/** Seed stubs for UI — still carry full lifecycle fields. */
export const JOB_STUBS: StudioJob[] = [
  createJob({
    id: "job-proxy",
    kind: "proxy",
    label: "Build edit proxy",
    note: "ffmpeg scale + faststart; no look change",
    idempotencyKey: "proxy-v1",
    requiresRubricPass: false,
  }),
  {
    ...createJob({
      id: "job-grade",
      kind: "grade-pass",
      label: "Restraint grade pass",
      note: "Requires rubric pass first",
      idempotencyKey: "grade-v1",
      requiresRubricPass: true,
    }),
    status: "planned",
  },
  createJob({
    id: "job-audio",
    kind: "audio-hierarchy",
    label: "Tactile sound hierarchy check",
    note: "Loudness + stem presence audit",
    idempotencyKey: "audio-v1",
  }),
  {
    ...createJob({
      id: "job-export",
      kind: "export",
      label: "Master export",
      note: "Human ship decision after rubric",
      idempotencyKey: "export-v1",
      requiresRubricPass: true,
    }),
  },
];
