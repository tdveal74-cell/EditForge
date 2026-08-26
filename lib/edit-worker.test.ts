import { afterEach, describe, expect, it, vi } from "vitest";
import { probeWorker, workerConfigured } from "./edit-worker";

afterEach(() => {
  delete process.env.EDITFORGE_WORKER_URL;
  delete process.env.EDITFORGE_WORKER_TOKEN;
  vi.restoreAllMocks();
});

describe("render worker readiness", () => {
  it("fails closed when either worker setting is absent", async () => {
    process.env.EDITFORGE_WORKER_URL = "https://worker.example";
    expect(workerConfigured()).toBe(false);
    expect(await probeWorker()).toEqual({ configured: false, reachable: false });
  });

  it("reports a configured worker only after its health endpoint answers", async () => {
    process.env.EDITFORGE_WORKER_URL = "https://worker.example/";
    process.env.EDITFORGE_WORKER_TOKEN = "worker-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "healthy" }), { status: 200 })));
    expect(await probeWorker()).toMatchObject({ configured: true, reachable: true });
    expect(fetch).toHaveBeenCalledWith("https://worker.example/health", expect.any(Object));
  });
});
