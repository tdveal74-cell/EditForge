import { describe, expect, it } from "vitest";
import {
  advanceJob,
  authorizeJob,
  canTransitionJob,
  createJob,
} from "./jobs";

describe("job lifecycle", () => {
  it("allows planned → authorized → queued → running → validating → completed", () => {
    let job = createJob({
      id: "j1",
      kind: "proxy",
      label: "Proxy",
      note: "n",
      idempotencyKey: "k1",
    });
    job = authorizeJob(job);
    expect(job.status).toBe("authorized");
    job = advanceJob(job, "queued");
    job = advanceJob(job, "running");
    job = advanceJob(job, "validating");
    job = advanceJob(job, "completed");
    expect(job.status).toBe("completed");
    expect(canTransitionJob("completed", "queued")).toBe(false);
  });

  it("blocks master-style jobs without rubric decision", () => {
    const job = createJob({
      id: "j2",
      kind: "export",
      label: "Export",
      note: "n",
      idempotencyKey: "k2",
      requiresRubricPass: true,
    });
    expect(() => authorizeJob(job)).toThrow(/Rubric pass/);
  });

  it("persists immutable rubric decision fields on authorize", () => {
    const job = createJob({
      id: "j3",
      kind: "export",
      label: "Export",
      note: "n",
      idempotencyKey: "k3",
      requiresRubricPass: true,
    });
    const authorized = authorizeJob(job, {
      cutHash: "abc123",
      rubricVersion: "restraint-1.0",
      reviewer: "operator",
      passed: true,
      decidedAt: "2026-08-11T00:00:00.000Z",
    });
    expect(authorized.rubricDecision?.cutHash).toBe("abc123");
    expect(authorized.rubricDecision?.rubricVersion).toBe("restraint-1.0");
  });
});
