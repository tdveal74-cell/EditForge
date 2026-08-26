import { durableCollection } from "./durable";
import {
  EDIT_RECEIPT_SCHEMA,
  commandHash,
  revisionId,
  type EditCommand,
} from "./editing";

export type EditExecutionStatus =
  | "accepted"
  | "dispatched"
  | "running"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled";

export type EditArtifact = {
  role: string;
  uri: string;
  sha256: string;
  mediaType: string;
};

export type EditReceipt = {
  schema: typeof EDIT_RECEIPT_SCHEMA;
  receiptId: string;
  commandId: string;
  revisionId: string;
  status: EditExecutionStatus;
  workerId?: string;
  artifacts: EditArtifact[];
  checks: string[];
  error?: string;
  recordedAt: string;
};

export type EditExecution = {
  id: string;
  command: EditCommand;
  commandHash: string;
  revisionId: string;
  parentRevisionId?: string;
  status: EditExecutionStatus;
  attempts: number;
  workerJobId?: string;
  receipt?: EditReceipt;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const executions = durableCollection<EditExecution>({
  key: "editforge:edit-executions",
  file: "edit-executions.json",
  seed: () => [],
});

export async function listEditExecutions(): Promise<EditExecution[]> {
  return executions.list();
}

export async function getEditExecution(id: string): Promise<EditExecution | null> {
  return executions.get(id);
}

export async function acceptEditCommand(command: EditCommand): Promise<{ execution: EditExecution; deduped: boolean }> {
  const existing = await executions.get(command.commandId);
  if (existing) {
    if (existing.commandHash !== commandHash(command)) {
      throw new Error("commandId already exists with different content");
    }
    return { execution: existing, deduped: true };
  }

  const now = new Date().toISOString();
  const execution: EditExecution = {
    id: command.commandId,
    command,
    commandHash: commandHash(command),
    revisionId: revisionId(command),
    status: "accepted",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };

  let stored = execution;
  await executions.mutate((all) => {
    const raced = all.find((item) => item.id === command.commandId);
    if (raced) {
      stored = raced;
      return;
    }
    all.unshift(execution);
  });
  if (stored.commandHash !== execution.commandHash) throw new Error("commandId collision detected");
  return { execution: stored, deduped: stored !== execution };
}

async function updateExecution(
  id: string,
  change: (execution: EditExecution) => void
): Promise<EditExecution | null> {
  let result: EditExecution | null = null;
  await executions.mutate((all) => {
    const index = all.findIndex((item) => item.id === id);
    if (index < 0) return;
    const next = structuredClone(all[index]);
    change(next);
    next.updatedAt = new Date().toISOString();
    all[index] = next;
    result = next;
  });
  return result;
}

export async function markDispatched(id: string, workerJobId: string): Promise<EditExecution | null> {
  return updateExecution(id, (execution) => {
    if (!["accepted", "failed"].includes(execution.status)) throw new Error(`cannot dispatch ${execution.status} execution`);
    execution.status = "dispatched";
    execution.workerJobId = workerJobId;
    execution.attempts += 1;
    delete execution.error;
  });
}

export async function markDispatchFailed(id: string, error: string): Promise<EditExecution | null> {
  return updateExecution(id, (execution) => {
    if (!["accepted", "failed"].includes(execution.status)) throw new Error(`cannot fail dispatch from ${execution.status}`);
    execution.status = "failed";
    execution.error = error;
    execution.attempts += 1;
  });
}

export async function recordWorkerReceipt(id: string, receipt: EditReceipt): Promise<EditExecution | null> {
  return updateExecution(id, (execution) => {
    if (receipt.schema !== EDIT_RECEIPT_SCHEMA) throw new Error("worker receipt schema mismatch");
    if (receipt.commandId !== execution.id) throw new Error("worker receipt command mismatch");
    if (receipt.revisionId !== execution.revisionId) throw new Error("worker receipt revision mismatch");
    if (!["completed", "failed", "cancelled"].includes(receipt.status)) {
      throw new Error("worker receipt must be terminal");
    }
    if (!Array.isArray(receipt.artifacts)) throw new Error("worker receipt artifacts must be an array");
    if (receipt.status === "completed" && receipt.artifacts.length === 0) {
      throw new Error("completed worker receipt requires an artifact");
    }
    for (const artifact of receipt.artifacts) {
      if (!artifact.uri || !/^[a-f0-9]{64}$/i.test(artifact.sha256)) {
        throw new Error("worker receipt artifact URI and SHA-256 are required");
      }
    }
    if (execution.status === "cancelled" && receipt.status !== "cancelled") {
      throw new Error("cancelled execution cannot be overwritten by a later worker receipt");
    }
    execution.status = receipt.status;
    execution.receipt = receipt;
    execution.error = receipt.error;
  });
}

export async function cancelEditExecution(id: string): Promise<EditExecution | null> {
  return updateExecution(id, (execution) => {
    if (execution.status === "completed") throw new Error("cannot cancel completed execution");
    if (execution.status === "cancelled") return;
    execution.status = "cancelled";
  });
}
