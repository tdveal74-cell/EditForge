import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { compileRenderPlan, validateWorkerCommand } from "./plan.mjs";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const TOKEN = process.env.EDITFORGE_WORKER_TOKEN || "";
const ROOT = path.resolve(process.env.EDITFORGE_WORK_DIR || "/tmp/editforge-worker");
const JOB_FILE = path.join(ROOT, "worker-jobs.json");
const MAX_BODY = 1_000_000;
const requestedConcurrency = Number(process.env.EDITFORGE_WORKER_CONCURRENCY || 1);
const MAX_CONCURRENCY = Number.isInteger(requestedConcurrency)
  ? Math.max(1, Math.min(8, requestedConcurrency))
  : 1;
let mutation = Promise.resolve();
const activeChildren = new Map();
const pendingJobs = [];
const scheduledJobs = new Set();
let activeJobs = 0;

function safeEqual(left, right) {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function authorized(req) {
  return TOKEN && safeEqual(req.headers.authorization?.replace(/^Bearer\s+/i, "").trim(), TOKEN);
}

async function readJobs() {
  await fs.mkdir(ROOT, { recursive: true });
  try {
    return JSON.parse(await fs.readFile(JOB_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function mutateJobs(change) {
  let output;
  const transaction = mutation.then(async () => {
    const jobs = await readJobs();
    output = change(jobs);
    const temporary = `${JOB_FILE}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(jobs, null, 2));
    await fs.rename(temporary, JOB_FILE);
  });
  mutation = transaction.then(
    () => undefined,
    () => undefined
  );
  await transaction;
  return output;
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function respond(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

async function download(uri, target) {
  const parsed = remoteMediaUrl(uri, "source URI");
  const response = await fetch(parsed, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`source download failed: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
}

function remoteMediaUrl(value, label) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`${label} must be HTTP or HTTPS`);
  if (process.env.NODE_ENV === "production" && process.env.EDITFORGE_ALLOW_PRIVATE_MEDIA_URLS !== "true") {
    if (parsed.protocol !== "https:") throw new Error(`${label} must use HTTPS in production`);
    const host = parsed.hostname.toLowerCase();
    const privateHost = host === "localhost" || host === "::1" || host.startsWith("127.") ||
      host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (privateHost) throw new Error(`${label} cannot target a private network address`);
  }
  return parsed;
}

async function sha256File(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function run(binary, args, workerJobId) {
  await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });
    if (workerJobId) activeChildren.set(workerJobId, child);
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 20_000) stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (workerJobId) activeChildren.delete(workerJobId);
      if (code === 0) resolve();
      else reject(new Error(`${binary} exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

async function binaryAvailable(binary) {
  try {
    await run(binary, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function jobCancelled(workerJobId) {
  const jobs = await readJobs();
  return jobs.find((item) => item.workerJobId === workerJobId)?.status === "cancelled";
}

async function assertNotCancelled(workerJobId) {
  if (await jobCancelled(workerJobId)) throw new Error("execution cancelled");
}

async function callAdapter(step, command, inputArtifact) {
  const endpoint = process.env[step.adapterEnv];
  const providerToken = process.env.EDITFORGE_PROVIDER_TOKEN;
  if (!endpoint || !providerToken) throw new Error(`${step.adapterEnv} and EDITFORGE_PROVIDER_TOKEN are required`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${providerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ commandId: command.commandId, projectId: command.projectId, operation: step.operation, identity: command.identity, canon: command.canon, input: inputArtifact }),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok || !value.artifact?.uri || !value.artifact?.sha256) {
    throw new Error(value.error || `${step.adapterEnv} failed: HTTP ${response.status}`);
  }
  return value.artifact;
}

async function upload(file, uploadUrl, commandId) {
  if (!uploadUrl) {
    const artifactDir = process.env.EDITFORGE_ARTIFACT_DIR?.trim();
    const artifactBase = process.env.EDITFORGE_ARTIFACT_BASE_URL?.trim().replace(/\/$/, "");
    if (artifactDir && artifactBase) {
      await fs.mkdir(artifactDir, { recursive: true });
      const safeId = commandId.replace(/[^A-Za-z0-9._-]/g, "-");
      const filename = `${safeId}${path.extname(file)}`;
      await fs.copyFile(file, path.join(artifactDir, filename));
      return `${artifactBase}/${encodeURIComponent(filename)}`;
    }
    if (process.env.NODE_ENV === "production" && process.env.EDITFORGE_ALLOW_LOCAL_ARTIFACTS !== "true") {
      throw new Error("output.uploadUrl or the self-hosted artifact store is required in production");
    }
    return `file://${file}`;
  }
  remoteMediaUrl(uploadUrl, "artifact upload URL");
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: createReadStream(file),
    duplex: "half",
    headers: { "Content-Type": "application/octet-stream" },
  });
  if (!response.ok) throw new Error(`artifact upload failed: HTTP ${response.status}`);
  return uploadUrl.split("?")[0];
}

async function callback(url, commandId, receipt) {
  if (!url) return;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "receipt", receipt }),
  });
  if (!response.ok) throw new Error(`receipt callback failed: HTTP ${response.status}`);
}

function callbackUrlFor(commandId, requested) {
  const origin = process.env.EDITFORGE_CALLBACK_ORIGIN?.trim().replace(/\/$/, "");
  return origin ? `${origin}/api/edits/${encodeURIComponent(commandId)}` : requested;
}

function schedule(job) {
  if (scheduledJobs.has(job.workerJobId)) return;
  scheduledJobs.add(job.workerJobId);
  pendingJobs.push(job);
  drain();
}

function drain() {
  while (activeJobs < MAX_CONCURRENCY && pendingJobs.length) {
    const job = pendingJobs.shift();
    activeJobs += 1;
    void (async () => {
      try {
        if (!(await jobCancelled(job.workerJobId))) await execute(job);
      } finally {
        activeJobs -= 1;
        scheduledJobs.delete(job.workerJobId);
        drain();
      }
    })();
  }
}

async function execute(job) {
  const work = path.join(ROOT, job.workerJobId);
  await fs.mkdir(work, { recursive: true });
  await mutateJobs((jobs) => {
    const stored = jobs.find((item) => item.workerJobId === job.workerJobId);
    stored.status = "running";
    stored.updatedAt = new Date().toISOString();
  });

  try {
    let artifact = { uri: job.command.source.uri, sha256: job.command.source.sha256, mediaType: "video/mp4" };
    const captionOperation = job.command.operations.find((operation) => operation.type === "captions");
    const captionPath = captionOperation?.params?.srtUri ? path.join(work, "captions.srt") : undefined;
    if (captionPath) await download(captionOperation.params.srtUri, captionPath);

    const extension = job.command.output.container;
    const inputPath = path.join(work, "input.mp4");
    const outputPath = path.join(work, `output.${extension}`);
    const plan = compileRenderPlan(job.command, { inputPath, outputPath, captionPath });

    for (const step of plan.adapterSteps) {
      await assertNotCancelled(job.workerJobId);
      artifact = await callAdapter(step, job.command, artifact);
    }
    await assertNotCancelled(job.workerJobId);
    await download(artifact.uri, inputPath);
    const actualInputHash = await sha256File(inputPath);
    if (actualInputHash.toLowerCase() !== artifact.sha256.toLowerCase()) throw new Error("input artifact SHA-256 mismatch");

    await assertNotCancelled(job.workerJobId);
    await run("ffmpeg", plan.ffmpegArgs, job.workerJobId);
    await assertNotCancelled(job.workerJobId);
    await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1", outputPath], job.workerJobId);
    const outputHash = await sha256File(outputPath);
    const uri = await upload(outputPath, job.command.output.uploadUrl, job.command.commandId);
    const receipt = {
      schema: "editforge.edit-receipt.v1",
      receiptId: `receipt-${job.command.commandId}`,
      commandId: job.command.commandId,
      revisionId: job.revisionId,
      status: "completed",
      workerId: process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || "editforge-worker",
      artifacts: [{ role: job.command.output.mode, uri, sha256: outputHash, mediaType: extension === "mov" ? "video/quicktime" : "video/mp4" }],
      checks: ["source hash verified", "ffmpeg exited 0", "ffprobe opened output", "output hash recorded"],
      recordedAt: new Date().toISOString(),
    };
    await mutateJobs((jobs) => Object.assign(jobs.find((item) => item.workerJobId === job.workerJobId), { status: "completed", receipt, updatedAt: receipt.recordedAt }));
    try {
      await callback(job.callbackUrl, job.command.commandId, receipt);
    } catch (error) {
      await mutateJobs((jobs) => {
        const stored = jobs.find((item) => item.workerJobId === job.workerJobId);
        stored.callbackError = error.message;
        stored.updatedAt = new Date().toISOString();
      });
    }
  } catch (error) {
    if (await jobCancelled(job.workerJobId)) return;
    const receipt = {
      schema: "editforge.edit-receipt.v1",
      receiptId: `receipt-${job.command.commandId}`,
      commandId: job.command.commandId,
      revisionId: job.revisionId,
      status: "failed",
      artifacts: [],
      checks: [],
      error: error.message,
      recordedAt: new Date().toISOString(),
    };
    await mutateJobs((jobs) => Object.assign(jobs.find((item) => item.workerJobId === job.workerJobId), { status: "failed", receipt, updatedAt: receipt.recordedAt }));
    try { await callback(job.callbackUrl, job.command.commandId, receipt); } catch { /* polling remains available */ }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      const [ffmpeg, ffprobe] = await Promise.all([binaryAvailable("ffmpeg"), binaryAvailable("ffprobe")]);
      return respond(res, ffmpeg && ffprobe ? 200 : 503, {
        status: ffmpeg && ffprobe ? "healthy" : "degraded",
        service: "editforge-worker",
        ffmpeg,
        ffprobe,
        activeJobs,
        queuedJobs: pendingJobs.length,
        maxConcurrency: MAX_CONCURRENCY,
      });
    }
    if (!authorized(req)) return respond(res, 401, { error: "worker authentication required" });

    if (req.method === "POST" && req.url === "/v1/execute") {
      const value = await body(req);
      const command = value.command;
      if (!command?.commandId || !value.commandHash || !value.revisionId) return respond(res, 422, { error: "command, commandHash, and revisionId required" });
      const issues = validateWorkerCommand(command);
      if (issues.length) return respond(res, 422, { error: "worker refused edit command", issues });
      const jobs = await readJobs();
      const existing = jobs.find((item) => item.command.commandId === command.commandId);
      if (existing) {
        if (existing.commandHash !== value.commandHash) return respond(res, 409, { error: "command id collision" });
        if (existing.status === "failed") {
          const retried = await mutateJobs((items) => {
            const stored = items.find((item) => item.workerJobId === existing.workerJobId);
            Object.assign(stored, { status: "queued", updatedAt: new Date().toISOString() });
            delete stored.receipt;
            delete stored.error;
            delete stored.callbackError;
            return structuredClone(stored);
          });
          setImmediate(() => schedule(retried));
          return respond(res, 202, { workerJobId: retried.workerJobId, deduped: true, retried: true });
        }
        return respond(res, 200, { workerJobId: existing.workerJobId, deduped: true });
      }
      const job = { workerJobId: `worker-${command.commandId}`, command, commandHash: value.commandHash, revisionId: value.revisionId, callbackUrl: callbackUrlFor(command.commandId, value.callbackUrl), status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await mutateJobs((items) => items.unshift(job));
      setImmediate(() => schedule(job));
      return respond(res, 202, { workerJobId: job.workerJobId, deduped: false });
    }

    const match = req.method === "GET" ? req.url?.match(/^\/v1\/jobs\/([^/?]+)$/) : null;
    if (match) {
      const jobs = await readJobs();
      const job = jobs.find((item) => item.workerJobId === decodeURIComponent(match[1]));
      return job ? respond(res, 200, { workerJobId: job.workerJobId, status: job.status, receipt: job.receipt }) : respond(res, 404, { error: "job not found" });
    }
    const cancelMatch = req.method === "POST" ? req.url?.match(/^\/v1\/jobs\/([^/?]+)\/cancel$/) : null;
    if (cancelMatch) {
      const workerJobId = decodeURIComponent(cancelMatch[1]);
      const jobs = await readJobs();
      const existing = jobs.find((item) => item.workerJobId === workerJobId);
      if (!existing) return respond(res, 404, { error: "job not found" });
      if (["completed", "cancelled"].includes(existing.status)) {
        return respond(res, 409, { error: `cannot cancel ${existing.status} job` });
      }
      activeChildren.get(workerJobId)?.kill("SIGTERM");
      const receipt = {
        schema: "editforge.edit-receipt.v1",
        receiptId: `receipt-${existing.command.commandId}`,
        commandId: existing.command.commandId,
        revisionId: existing.revisionId,
        status: "cancelled",
        artifacts: [],
        checks: ["cancellation recorded"],
        recordedAt: new Date().toISOString(),
      };
      const cancelled = await mutateJobs((items) => {
        const stored = items.find((item) => item.workerJobId === workerJobId);
        Object.assign(stored, { status: "cancelled", receipt, updatedAt: receipt.recordedAt });
        return structuredClone(stored);
      });
      try { await callback(cancelled.callbackUrl, cancelled.command.commandId, receipt); } catch { /* polling remains available */ }
      return respond(res, 200, { workerJobId, status: "cancelled", receipt });
    }
    return respond(res, 404, { error: "not found" });
  } catch (error) {
    return respond(res, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, async () => {
  process.stdout.write(`EditForge worker listening on ${HOST}:${PORT}\n`);
  const jobs = await readJobs();
  for (const job of jobs.filter((item) => ["queued", "running"].includes(item.status))) {
    await mutateJobs((items) => {
      const stored = items.find((item) => item.workerJobId === job.workerJobId);
      stored.status = "queued";
      stored.updatedAt = new Date().toISOString();
    });
    schedule({ ...job, status: "queued" });
  }
});
