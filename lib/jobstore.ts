import { durableCollection } from "./durable";
import {
  advanceJob,
  authorizeJob,
  createJob,
  isTerminal,
  type JobKind,
  type RubricDecision,
  type StudioJob,
} from "./jobs";
import { pollProvider, submitToProvider } from "./providers";

/**
 * Durable jobs plus the worker drive loop.
 *
 * Jobs live in the same Redis-or-file collection as cuts, so a job submitted by
 * one serverless instance is pollable from another. Every state change goes
 * through `lib/jobs.ts`, so an illegal transition throws rather than silently
 * corrupting the record.
 */

const jobs = durableCollection<StudioJob>({
  key: "editforge:jobs",
  file: "jobs.json",
  seed: () => [],
});

export async function listJobs(): Promise<StudioJob[]> {
  return jobs.list();
}

export async function getJob(id: string): Promise<StudioJob | null> {
  return jobs.get(id);
}

/** Find an existing job by its idempotency key, so a retried submit is a no-op. */
export async function findByIdempotencyKey(
  key: string,
): Promise<StudioJob | null> {
  const all = await jobs.list();
  return all.find((j) => j.idempotencyKey === key) ?? null;
}

function newId(kind: JobKind, key: string): string {
  return `job-${kind}-${key}`;
}

export type CreateInput = {
  kind: JobKind;
  label: string;
  note: string;
  idempotencyKey: string;
  requiresRubricPass?: boolean;
  rubricDecision?: RubricDecision;
};

/**
 * Create → authorize → queue, persisted as one durable record.
 *
 * Returns the existing job untouched when the idempotency key has been seen,
 * so a client retry never doubles the work or the spend.
 */
export async function createAndQueue(input: CreateInput): Promise<StudioJob> {
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) return existing;

  // Throws before anything is persisted if the rubric gate is not satisfied.
  const authorized = authorizeJob(
    createJob({ ...input, id: newId(input.kind, input.idempotencyKey) }),
    input.rubricDecision,
  );
  const queued = advanceJob(authorized, "queued");

  let stored = queued;
  await jobs.mutate((all) => {
    // Re-check inside the transaction: another instance may have won the race.
    const dupe = all.find((j) => j.idempotencyKey === input.idempotencyKey);
    if (dupe) {
      stored = dupe;
      return;
    }
    all.unshift(queued);
  });
  return stored;
}

/** Apply a change to a stored job through the state machine, and persist it. */
async function update(
  id: string,
  fn: (job: StudioJob) => void,
): Promise<StudioJob | null> {
  let out: StudioJob | null = null;
  await jobs.mutate((all) => {
    const i = all.findIndex((j) => j.id === id);
    if (i < 0) return;
    const next = { ...all[i] };
    fn(next);
    next.updatedAt = new Date().toISOString();
    all[i] = next;
    out = next;
  });
  return out;
}

/**
 * Hand a queued job to its provider.
 *
 * A refused submit moves the job to `failed` with the reason recorded — it is
 * never left sitting in `queued` looking like it is still coming.
 */
export async function submitJob(
  id: string,
  req: { provider: string; prompt: string; options?: Record<string, unknown> },
): Promise<StudioJob | null> {
  // Claim before crossing the paid boundary. Two callers can observe `queued`
  // together; only the winner of this durable mutation may submit it.
  let claimed = false;
  const job = await update(id, (j) => {
    claimed = false;
    if (j.status !== "queued") return;
    claimed = true;
    j.status = advanceJob(j, "running").status;
    j.attempts += 1;
    j.provider = req.provider;
    j.note =
      "Submitting to provider. Do not resubmit while the result is unknown.";
  });
  if (!job || !claimed) return job;

  const res = await submitToProvider({
    provider: req.provider,
    kind: job.kind,
    prompt: req.prompt,
    idempotencyKey: job.idempotencyKey,
    options: req.options,
  });

  return update(id, (j) => {
    j.provider = res.provider;
    j.mode = res.mode;
    // A cancellation during submit stops local tracking, not provider billing.
    // Keep its receipt without reviving the cancelled job.
    if (j.status !== "running") {
      if (res.ok) {
        j.externalId = res.externalId;
        if (res.result) j.result = res.result;
      }
      return;
    }
    if (!res.ok) {
      advanceJob(j, "failed"); // asserts the edge exists
      j.status = "failed";
      j.error = res.error;
      return;
    }
    j.externalId = res.externalId;
    j.note = res.note;
    delete j.error;

    // Some providers answer the submit with the finished media rather than a
    // task id. Leaving those in `running` would park completed work behind a
    // poll that has nothing to ask, so they go straight to the human-accept
    // stage — which is still a stage, not a skip.
    if (res.state === "succeeded") {
      advanceJob(j, "validating");
      j.status = "validating";
      if (res.result) j.result = res.result;
    }
  });
}

/**
 * Poll the provider and move the job along.
 *
 * Success routes through `validating` before `completed`, so the rubric/QC step
 * always has a state to sit in rather than being skipped.
 */
export async function pollJob(id: string): Promise<StudioJob | null> {
  const job = await getJob(id);
  if (!job) return null;
  if (isTerminal(job.status)) return job;
  if (job.status !== "running" || !job.provider || !job.externalId) return job;

  const res = await pollProvider(job.provider, job.externalId);

  return update(id, (j) => {
    if (j.status !== "running") return;
    if (!res.ok) {
      advanceJob(j, "failed");
      j.status = "failed";
      j.error = res.error;
      return;
    }
    if (res.state === "failed") {
      advanceJob(j, "failed");
      j.status = "failed";
      j.error = res.note ?? "Provider reported failure";
      return;
    }
    if (res.state === "succeeded") {
      advanceJob(j, "validating");
      j.status = "validating";
      if (res.result) j.result = res.result;
      if (res.note) j.note = res.note;
    }
    // queued / running: nothing to change but the timestamp.
  });
}

/** Close out a validated job. Kept separate so QC stays an explicit step. */
export async function completeJob(id: string): Promise<StudioJob | null> {
  return update(id, (j) => {
    advanceJob(j, "completed");
    j.status = "completed";
  });
}

/** Re-queue a failed job. The only retry edge the machine allows. */
export async function retryJob(id: string): Promise<StudioJob | null> {
  return update(id, (j) => {
    advanceJob(j, "queued");
    j.status = "queued";
    delete j.error;
    delete j.externalId;
  });
}

export async function cancelJob(id: string): Promise<StudioJob | null> {
  return update(id, (j) => {
    advanceJob(j, "cancelled");
    j.status = "cancelled";
  });
}
