export type ForgeEngineState = {
  ready: boolean;
  licenseAccepted: boolean;
  detail: string;
};

export type ForgeWorkerHealth = {
  ok: boolean;
  service: string;
  version: string;
  engines: Record<string, ForgeEngineState>;
  readyFor: {
    voice: boolean;
    avatar: boolean;
    lipSync: boolean;
    genVideo: boolean;
    mastering: boolean;
    proofShot: boolean;
    episodeGenerate: boolean;
  };
};

export type UploadTicketRequest = {
  filename: string;
  kind: string;
  mimeType: string;
  maxBytes: number;
  sha256: string;
  consentId?: string;
};

export type UploadTicket = {
  ticket: string;
  uploadPath: string;
  uploadUrl: string;
  expiresAt: number;
};

export type WorkerAsset = {
  id: string;
  kind: string;
  label: string;
  filename: string;
  mimeType: string;
  bytes: number;
  sha256: string;
  consentId?: string;
  createdAt: number;
};

export type ForgeWorkerConfig = {
  url: string;
  publicUrl: string;
  token: string;
};

function normalizeUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a complete http(s) URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  return url.toString().replace(/\/$/, "");
}

export function forgeWorkerConfig(): ForgeWorkerConfig {
  const rawUrl = process.env.EDITFORGE_WORKER_URL?.trim();
  const token = process.env.EDITFORGE_WORKER_TOKEN?.trim();
  if (!rawUrl) throw new Error("EDITFORGE_WORKER_URL is not configured");
  if (!token || token.length < 24) {
    throw new Error("EDITFORGE_WORKER_TOKEN must contain at least 24 characters");
  }
  const url = normalizeUrl(rawUrl, "EDITFORGE_WORKER_URL");
  const publicUrl = process.env.EDITFORGE_WORKER_PUBLIC_URL?.trim()
    ? normalizeUrl(process.env.EDITFORGE_WORKER_PUBLIC_URL, "EDITFORGE_WORKER_PUBLIC_URL")
    : url;
  return { url, publicUrl, token };
}

export function workerIsLoopback(): boolean {
  try {
    const host = new URL(forgeWorkerConfig().url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

async function workerFetch(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const config = forgeWorkerConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${config.url}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`Forge Worker timed out after ${timeoutMs}ms`);
    }
    throw new Error(`Forge Worker unreachable: ${(error as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Forge Worker returned HTTP ${response.status}`);
  }
  return body;
}

export async function getForgeWorkerHealth(): Promise<ForgeWorkerHealth> {
  const response = await workerFetch("/v1/capabilities", {}, 5000);
  return jsonOrError<ForgeWorkerHealth>(response);
}

export async function createForgeUploadTicket(input: UploadTicketRequest): Promise<UploadTicket> {
  const response = await workerFetch("/v1/upload-tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const ticket = await jsonOrError<Omit<UploadTicket, "uploadUrl">>(response);
  const { publicUrl } = forgeWorkerConfig();
  return { ...ticket, uploadUrl: `${publicUrl}${ticket.uploadPath}` };
}

export async function fetchForgeArtifact(id: string, range?: string | null): Promise<Response> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id)) {
    throw new Error("Invalid artifact id");
  }
  return workerFetch(`/v1/artifacts/${encodeURIComponent(id)}`, {
    headers: range ? { Range: range } : undefined,
  }, 30000);
}

export function workerResultToStudioUrl(provider: string, result: string | undefined): string | undefined {
  if (!result || provider !== "forge-worker") return result;
  const match = result.match(/^\/v1\/artifacts\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})$/);
  return match ? `/api/production/artifacts/${encodeURIComponent(match[1])}` : result;
}

export function artifactIdFromStudioUrl(result: string | undefined): string | undefined {
  const match = result?.match(/^\/api\/production\/artifacts\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})$/);
  return match?.[1];
}
