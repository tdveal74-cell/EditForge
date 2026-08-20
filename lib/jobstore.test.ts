import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import {
  cancelJob,
  completeJob,
  createAndQueue,
  getJob,
  listJobs,
  pollJob,
  retryJob,
  submitJob,
} from "./jobstore";
import type { RubricDecision } from "./jobs";

// No KV in tests: the file backend is exercised, which is the same code path
// with a different sink. Start from a clean store each time, in this file's own
// data dir — test files run in parallel and would otherwise share one store.
const DATA_DIR = path.join(process.cwd(), ".data-test-jobstore");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

const SPEND_KEYS = [
  "RUNWAY_COST_PER_SECOND_USD",
  "EDITFORGE_SPEND_MODE",
  "EDITFORGE_BILLING_ENABLED",
  "EDITFORGE_TOTAL_BUDGET_USD",
  "EDITFORGE_SPENT_USD",
  "EDITFORGE_PER_JOB_LIMIT_USD",
];

function enableRunwaySpend() {
  process.env.RUNWAY_COST_PER_SECOND_USD = "0.05";
  process.env.EDITFORGE_SPEND_MODE = "controlled";
  process.env.EDITFORGE_BILLING_ENABLED = "true";
  process.env.EDITFORGE_TOTAL_BUDGET_USD = "10";
  process.env.EDITFORGE_SPENT_USD = "0";
  process.env.EDITFORGE_PER_JOB_LIMIT_USD = "1";
}

const PASS: RubricDecision = {
  cutHash: "abc123",
  rubricVersion: "restraint-1.0",
  reviewer: "director",
  passed: true,
  decidedAt: new Date().toISOString(),
};

beforeEach(async () => {
  await fs.rm(JOBS_FILE, { force: true });
  for (const key of SPEND_KEYS) delete process.env[key];
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RUNWAY_API_KEY;
  for (const key of SPEND_KEYS) delete process.env[key];
});

describe("durable job lifecycle", () => {
  it("creates, queues, submits, polls, and completes a mock job", async () => {
    const job = await createAndQueue({
      kind: "gen-video",
      label: "Atmosphere insert",
      note: "queued",
      idempotencyKey: "run-1",
    });
    expect(job.status).toBe("queued");
    expect(job.attempts).toBe(0);

    const submitted = await submitJob(job.id, { provider: "mock", prompt: "empty room" });
    expect(submitted?.status).toBe("running");
    expect(submitted?.mode).toBe("mock");
    expect(submitted?.attempts).toBe(1);
    expect(submitted?.externalId).toBeTruthy();

    const polled = await pollJob(job.id);
    // Success routes through validating so QC is never skipped.
    expect(polled?.status).toBe("validating");

    const done = await completeJob(job.id);
    expect(done?.status).toBe("completed");

    // Survives a fresh read — it is actually persisted, not in-memory.
    expect((await getJob(job.id))?.status).toBe("completed");
  });

  it("returns the existing job for a repeated idempotency key", async () => {
    const a = await createAndQueue({ kind: "voice", label: "VO", note: "n", idempotencyKey: "dupe" });
    const b = await createAndQueue({ kind: "voice", label: "VO again", note: "n", idempotencyKey: "dupe" });
    expect(b.id).toBe(a.id);
    expect((await listJobs()).filter((j) => j.idempotencyKey === "dupe")).toHaveLength(1);
  });

  it("refuses to create a rubric-gated job without a passing decision", async () => {
    await expect(
      createAndQueue({
        kind: "gen-video",
        label: "Master insert",
        note: "n",
        idempotencyKey: "gated",
        requiresRubricPass: true,
      })
    ).rejects.toThrow(/Rubric pass/);

    // Nothing was persisted by the rejected attempt.
    expect(await listJobs()).toHaveLength(0);
  });

  it("accepts a rubric-gated job when the decision passes, and keeps the record", async () => {
    const job = await createAndQueue({
      kind: "gen-video",
      label: "Master insert",
      note: "n",
      idempotencyKey: "gated-ok",
      requiresRubricPass: true,
      rubricDecision: PASS,
    });
    expect(job.status).toBe("queued");
    expect(job.rubricDecision?.reviewer).toBe("director");
  });

  it("fails a job whose submit never reached the provider, recording why", async () => {
    delete process.env.RUNWAY_API_KEY;
    const job = await createAndQueue({ kind: "gen-video", label: "x", note: "n", idempotencyKey: "no-key" });

    const failed = await submitJob(job.id, { provider: "runway", prompt: "x" });
    // The queued → failed edge exists precisely so this is not laundered
    // through `running`, which would misreport what happened.
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toContain("RUNWAY_API_KEY");
    expect(failed?.externalId).toBeUndefined();
    expect(failed?.attempts).toBe(1);
  });

  it("retries a failed job and clears the stale error and external id", async () => {
    delete process.env.RUNWAY_API_KEY;
    const job = await createAndQueue({ kind: "gen-video", label: "x", note: "n", idempotencyKey: "retry-me" });
    await submitJob(job.id, { provider: "runway", prompt: "x" });

    const requeued = await retryJob(job.id);
    expect(requeued?.status).toBe("queued");
    expect(requeued?.error).toBeUndefined();
    expect(requeued?.externalId).toBeUndefined();

    // The retry can now succeed against the offline provider.
    const submitted = await submitJob(job.id, { provider: "mock", prompt: "x" });
    expect(submitted?.status).toBe("running");
    expect(submitted?.attempts).toBe(2);
  });

  it("carries a provider failure onto the job with its reason", async () => {
    process.env.RUNWAY_API_KEY = "tok";
    enableRunwaySpend();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) =>
        String(url).includes("/tasks/")
          ? ({ ok: true, json: async () => ({ status: "failed", failure: "content policy" }) } as unknown as Response)
          : ({ ok: true, json: async () => ({ id: "task_1" }) } as unknown as Response)
      )
    );

    const job = await createAndQueue({ kind: "gen-video", label: "x", note: "n", idempotencyKey: "prov-fail" });
    await submitJob(job.id, { provider: "runway", prompt: "x" });
    const polled = await pollJob(job.id);

    expect(polled?.status).toBe("failed");
    expect(polled?.error).toBe("content policy");
  });

  it("keeps a still-running job in place rather than guessing", async () => {
    process.env.RUNWAY_API_KEY = "tok";
    enableRunwaySpend();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) =>
        String(url).includes("/tasks/")
          ? ({ ok: true, json: async () => ({ status: "in_progress" }) } as unknown as Response)
          : ({ ok: true, json: async () => ({ id: "task_2" }) } as unknown as Response)
      )
    );

    const job = await createAndQueue({ kind: "gen-video", label: "x", note: "n", idempotencyKey: "still-going" });
    await submitJob(job.id, { provider: "runway", prompt: "x" });
    const polled = await pollJob(job.id);
    expect(polled?.status).toBe("running");
  });

  it("stores the output url when the provider succeeds", async () => {
    process.env.RUNWAY_API_KEY = "tok";
    enableRunwaySpend();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) =>
        String(url).includes("/tasks/")
          ? ({
              ok: true,
              json: async () => ({ status: "SUCCEEDED", output: ["https://cdn.example.test/a.mp4"] }),
            } as unknown as Response)
          : ({ ok: true, json: async () => ({ id: "task_3" }) } as unknown as Response)
      )
    );

    const job = await createAndQueue({ kind: "gen-video", label: "x", note: "n", idempotencyKey: "ok-out" });
    await submitJob(job.id, { provider: "runway", prompt: "x" });
    const polled = await pollJob(job.id);

    expect(polled?.status).toBe("validating");
    expect(polled?.result).toBe("https://cdn.example.test/a.mp4");
  });

  it("leaves terminal jobs alone when polled", async () => {
    const job = await createAndQueue({ kind: "voice", label: "x", note: "n", idempotencyKey: "term" });
    const cancelled = await cancelJob(job.id);
    expect(cancelled?.status).toBe("cancelled");

    const polled = await pollJob(job.id);
    expect(polled?.status).toBe("cancelled");
  });

  it("returns null for a job that does not exist", async () => {
    expect(await getJob("nope")).toBeNull();
    expect(await pollJob("nope")).toBeNull();
    expect(await submitJob("nope", { provider: "mock", prompt: "x" })).toBeNull();
  });
});
