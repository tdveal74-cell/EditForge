import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { EDIT_COMMAND_SCHEMA, EDIT_RECEIPT_SCHEMA, type EditCommand } from "./editing";

const DATA_DIR = path.join(process.cwd(), ".data-test-editstore");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { acceptEditCommand, cancelEditExecution, getEditExecution, markDispatched, recordWorkerReceipt } = await import("./editstore");

const command: EditCommand = {
  schema: EDIT_COMMAND_SCHEMA,
  commandId: "cmd-store-001",
  projectId: "project-store-001",
  cutId: "cut-store-001",
  property: "tqo",
  deliverable: "short-form",
  issuedBy: "DEVON",
  source: { uri: "https://media.example/source.mp4", sha256: "b".repeat(64) },
  canon: { version: "tqo-v1", locked: true },
  authorization: { approvalId: "approval-001", approvedBy: "Tee", scopes: ["edit:*"] },
  operations: [{ id: "op-reframe", type: "reframe", params: { aspect: "9:16" } }],
  output: { mode: "preview", width: 1080, height: 1920, fps: 30, container: "mp4" },
};

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "edit-executions.json"), { force: true });
});

describe("durable non-destructive edit execution", () => {
  it("deduplicates the same command and refuses changed content under the same id", async () => {
    const first = await acceptEditCommand(command);
    const second = await acceptEditCommand(command);
    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);

    await expect(
      acceptEditCommand({ ...command, output: { ...command.output, width: 2160 } })
    ).rejects.toThrow(/different content/);
  });

  it("records the worker job and matching receipt", async () => {
    const accepted = await acceptEditCommand(command);
    await markDispatched(command.commandId, "worker-001");
    await recordWorkerReceipt(command.commandId, {
      schema: EDIT_RECEIPT_SCHEMA,
      receiptId: "receipt-001",
      commandId: command.commandId,
      revisionId: accepted.execution.revisionId,
      status: "completed",
      workerId: "railway-worker-1",
      artifacts: [{ role: "preview", uri: "https://media.example/out.mp4", sha256: "c".repeat(64), mediaType: "video/mp4" }],
      checks: ["ffprobe passed", "identity lock preserved"],
      recordedAt: new Date().toISOString(),
    });
    expect((await getEditExecution(command.commandId))?.status).toBe("completed");
  });

  it("refuses a receipt for another revision", async () => {
    await acceptEditCommand(command);
    await expect(
      recordWorkerReceipt(command.commandId, {
        schema: EDIT_RECEIPT_SCHEMA,
        receiptId: "receipt-wrong",
        commandId: command.commandId,
        revisionId: "rev-wrong",
        status: "completed",
        artifacts: [],
        checks: [],
        recordedAt: new Date().toISOString(),
      })
    ).rejects.toThrow(/revision mismatch/);
  });

  it("does not let a late completion overwrite a cancellation", async () => {
    const accepted = await acceptEditCommand(command);
    await markDispatched(command.commandId, "worker-001");
    await cancelEditExecution(command.commandId);
    await expect(
      recordWorkerReceipt(command.commandId, {
        schema: EDIT_RECEIPT_SCHEMA,
        receiptId: "receipt-late",
        commandId: command.commandId,
        revisionId: accepted.execution.revisionId,
        status: "completed",
        artifacts: [{ role: "preview", uri: "https://media.example/out.mp4", sha256: "c".repeat(64), mediaType: "video/mp4" }],
        checks: [],
        recordedAt: new Date().toISOString(),
      })
    ).rejects.toThrow(/cancelled execution/);
    expect((await getEditExecution(command.commandId))?.status).toBe("cancelled");
    await expect(cancelEditExecution(command.commandId)).resolves.toMatchObject({ status: "cancelled" });
  });

  it("refuses a completed receipt with no artifact", async () => {
    const accepted = await acceptEditCommand(command);
    await expect(
      recordWorkerReceipt(command.commandId, {
        schema: EDIT_RECEIPT_SCHEMA,
        receiptId: "receipt-empty",
        commandId: command.commandId,
        revisionId: accepted.execution.revisionId,
        status: "completed",
        artifacts: [],
        checks: [],
        recordedAt: new Date().toISOString(),
      })
    ).rejects.toThrow(/requires an artifact/);
  });
});
