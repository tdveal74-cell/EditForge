import type { EditExecution, EditReceipt } from "./editstore";

export type WorkerDispatchResult =
  | { ok: true; workerJobId: string }
  | { ok: false; error: string };

const WORKER_CONTROL_TIMEOUT_MS = 15_000;

function workerConfig(): { url: string; token: string } | null {
  const url = process.env.EDITFORGE_WORKER_URL?.trim().replace(/\/$/, "");
  const token = process.env.EDITFORGE_WORKER_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

export function workerConfigured(): boolean {
  return workerConfig() !== null;
}

export async function probeWorker(): Promise<{
  configured: boolean;
  reachable: boolean;
  status?: unknown;
  error?: string;
}> {
  const config = workerConfig();
  if (!config) return { configured: false, reachable: false };
  try {
    const response = await fetch(`${config.url}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const status = await response.json().catch(() => ({}));
    return response.ok
      ? { configured: true, reachable: true, status }
      : { configured: true, reachable: false, status, error: `worker health HTTP ${response.status}` };
  } catch (error) {
    return { configured: true, reachable: false, error: (error as Error).message };
  }
}

export async function dispatchToWorker(execution: EditExecution): Promise<WorkerDispatchResult> {
  const config = workerConfig();
  if (!config) return { ok: false, error: "EDITFORGE_WORKER_URL and EDITFORGE_WORKER_TOKEN are required" };

  const callbackBase = (
    process.env.EDITFORGE_WORKER_CALLBACK_BASE_URL || process.env.EDITFORGE_PUBLIC_URL || ""
  ).trim().replace(/\/$/, "");
  try {
    const response = await fetch(`${config.url}/v1/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": execution.command.commandId,
      },
      body: JSON.stringify({
        command: execution.command,
        commandHash: execution.commandHash,
        revisionId: execution.revisionId,
        callbackUrl: callbackBase
          ? `${callbackBase}/api/edits/${encodeURIComponent(execution.id)}`
          : undefined,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(WORKER_CONTROL_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => ({}))) as { workerJobId?: string; error?: string };
    if (!response.ok || !body.workerJobId) {
      return { ok: false, error: body.error || `worker dispatch failed: HTTP ${response.status}` };
    }
    return { ok: true, workerJobId: body.workerJobId };
  } catch (error) {
    return { ok: false, error: `worker unreachable: ${(error as Error).message}` };
  }
}

export async function pollWorker(workerJobId: string): Promise<EditReceipt | null> {
  const config = workerConfig();
  if (!config) throw new Error("EditForge worker is not configured");
  const response = await fetch(`${config.url}/v1/jobs/${encodeURIComponent(workerJobId)}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(WORKER_CONTROL_TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`worker poll failed: HTTP ${response.status}`);
  const body = (await response.json()) as { receipt?: EditReceipt };
  return body.receipt ?? null;
}

export async function cancelWorker(workerJobId: string): Promise<void> {
  const config = workerConfig();
  if (!config) throw new Error("EditForge worker is not configured");
  const response = await fetch(`${config.url}/v1/jobs/${encodeURIComponent(workerJobId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(WORKER_CONTROL_TIMEOUT_MS),
  });
  if (!response.ok && response.status !== 409) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `worker cancellation failed: HTTP ${response.status}`);
  }
}
