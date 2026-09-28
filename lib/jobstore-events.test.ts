import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { subscribeToJobEvents, type JobEvent } from "./job-events";
import { createAndQueue, completeJob, pollJob, submitJob } from "./jobstore";

// Same isolated store discipline as jobstore.test.ts.
const DATA_DIR = path.join(process.cwd(), ".data-test-jobstore-events");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "jobs.json"), { force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("jobstore emits state-change events", () => {
  it("publishes queued → running → validating → completed as the job moves", async () => {
    process.env.RUNWAY_API_KEY = "tok";
    const events: JobEvent[] = [];
    const off = subscribeToJobEvents((e) => events.push(e));

    const job = await createAndQueue({
      kind: "gen-video",
      label: "L",
      note: "",
      idempotencyKey: "evt-1",
    });
    expect(events.map((e) => e.status)).toEqual(["queued"]);

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({ ok: true, json: async () => ({ id: "ext-e1" }) }) as unknown as Response,
      ),
    );
    await submitJob(job.id, { provider: "runway", prompt: "x" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () => ({ status: "SUCCEEDED", output: ["https://v.example/v.mp4"] }),
          }) as unknown as Response,
      ),
    );
    await pollJob(job.id);
    await completeJob(job.id);

    expect(events.map((e) => e.status)).toEqual([
      "queued",
      "running",
      "validating",
      "completed",
    ]);
    expect(events.every((e) => e.jobId === job.id)).toBe(true);
    off();
  });
});
