import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAX_BODY_BYTES = 1_000_000;
const MAX_INLINE_MEDIA_BYTES = 16 * 1024 * 1024;
const UPSTREAM_REQUEST_TIMEOUT_MS = 30_000;
const MEDIA_TRANSFER_TIMEOUT_MS = 5 * 60 * 1000;
const TERMINAL_RUNWAY_STATES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

function safeEqual(left, right) {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function contentTypeExtension(contentType, fallback) {
  const normalized = asText(contentType).split(";")[0].toLowerCase();
  const extensions = new Map([
    ["audio/mpeg", ".mp3"],
    ["audio/mp3", ".mp3"],
    ["audio/wav", ".wav"],
    ["audio/x-wav", ".wav"],
    ["video/mp4", ".mp4"],
    ["video/quicktime", ".mov"],
  ]);
  return extensions.get(normalized) || fallback;
}

function mediaTypeForExtension(extension) {
  return extension === ".mp3" ? "audio/mpeg"
    : extension === ".wav" ? "audio/wav"
      : extension === ".mov" ? "video/quicktime"
        : "video/mp4";
}

function imageMediaType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return "";
}

function isChildPath(root, candidate) {
  const relative = path.relative(root, candidate);
  return Boolean(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function privateImageAsDataUri(filename, env) {
  const secretRoot = path.resolve(asText(env.EDITFORGE_PROVIDER_SECRET_DIR) || "/run/secrets");
  const resolved = path.resolve(filename);
  if (!isChildPath(secretRoot, resolved)) {
    throw new Error("canonical Runway character file must be inside the provider secret directory");
  }
  const [realRoot, realFile] = await Promise.all([fs.realpath(secretRoot), fs.realpath(resolved)]);
  if (!isChildPath(realRoot, realFile)) {
    throw new Error("canonical Runway character file must be inside the provider secret directory");
  }
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) throw new Error("canonical Runway character file must be a regular file");
  if (stat.size <= 0 || stat.size > MAX_INLINE_MEDIA_BYTES) {
    throw new Error("canonical Runway character file must be between 1 byte and 16MB");
  }
  const buffer = await fs.readFile(resolved);
  const contentType = imageMediaType(buffer);
  if (!contentType) throw new Error("canonical Runway character file must be PNG, JPEG, or WebP");
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function respond(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

async function hashFile(filename) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
}

async function identityRegistry(env) {
  const filename = asText(env.EDITFORGE_IDENTITY_REGISTRY_FILE);
  if (!filename) throw new Error("EDITFORGE_IDENTITY_REGISTRY_FILE is required");
  const registry = JSON.parse(await fs.readFile(filename, "utf8"));
  if (registry?.schema !== "editforge.identity-registry.v1" || !Array.isArray(registry.identities)) {
    throw new Error("identity registry schema mismatch");
  }
  return registry;
}

async function resolveIdentity(request, env) {
  const identity = request?.identity;
  if (!identity?.version || !identity?.cloneId || !identity?.voiceId || identity?.consentRecorded !== true) {
    throw new Error("locked consented command identity is required");
  }
  const registry = await identityRegistry(env);
  const record = registry.identities.find((item) => item.id === identity.version);
  if (!record || record.cloneId !== identity.cloneId || record.voiceId !== identity.voiceId) {
    throw new Error("command identity does not match the canonical identity registry");
  }
  if (record.consentRecorded !== true) throw new Error("canonical identity consent is not recorded");
  if (!Array.isArray(record.properties) || !record.properties.includes(request.property)) {
    throw new Error(`identity ${record.id} is not authorized for ${request.property || "this property"}`);
  }
  return record;
}

function operationBudget(operation, env) {
  const requested = finite(operation?.params?.maxCredits);
  const hostLimit = finite(env.EDITFORGE_PROVIDER_MAX_CREDITS_PER_JOB);
  if (requested === null || requested <= 0) throw new Error("operation.params.maxCredits is required for paid generation");
  if (hostLimit === null || hostLimit <= 0) throw new Error("EDITFORGE_PROVIDER_MAX_CREDITS_PER_JOB is required");
  return Math.min(requested, hostLimit);
}

function upstreamHeaders(env) {
  const key = asText(env.RUNWAYML_API_SECRET);
  if (!key) throw new Error("RUNWAYML_API_SECRET is required");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "X-Runway-Version": asText(env.RUNWAY_API_VERSION) || "2024-11-06",
  };
}

async function runwayJson(fetchImpl, env, pathname, init = {}) {
  const base = (asText(env.RUNWAY_API_BASE_URL) || "https://api.dev.runwayml.com/v1").replace(/\/$/, "");
  const response = await fetchImpl(`${base}/${pathname.replace(/^\//, "")}`, {
    ...init,
    headers: { ...upstreamHeaders(env), ...(init.headers || {}) },
    signal: init.signal || AbortSignal.timeout(UPSTREAM_REQUEST_TIMEOUT_MS),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const issues = Array.isArray(value.issues) ? ` (${value.issues.map((item) => item.message).join(", ")})` : "";
    throw new Error(`${value.error || `Runway HTTP ${response.status}`}${issues}`);
  }
  return value;
}

async function cancelRunwayTask(fetchImpl, env, taskId) {
  try {
    await runwayJson(fetchImpl, env, `tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
  } catch {
    // Preserve the original budget or task failure.
  }
}

async function runRunwayTask(fetchImpl, env, pathname, payload, maxCredits) {
  const created = await runwayJson(fetchImpl, env, pathname, { method: "POST", body: JSON.stringify(payload) });
  if (!created.id) throw new Error("Runway did not return a task id");
  const estimated = finite(created.estimatedCost?.credits);
  if (estimated !== null && estimated > maxCredits) {
    await cancelRunwayTask(fetchImpl, env, created.id);
    throw new Error(`Runway estimate ${estimated} credits exceeds approved ceiling ${maxCredits}`);
  }
  const pollMs = clamp(finite(env.RUNWAY_POLL_INTERVAL_MS) || 5000, 250, 30000);
  const timeoutMs = clamp(finite(env.RUNWAY_TASK_TIMEOUT_MS) || 1_800_000, 10_000, 3_600_000);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = await runwayJson(fetchImpl, env, `tasks/${encodeURIComponent(created.id)}`, { method: "GET" });
    const polledEstimate = finite(task.estimatedCost?.credits);
    if (polledEstimate !== null && polledEstimate > maxCredits) {
      await cancelRunwayTask(fetchImpl, env, created.id);
      throw new Error(`Runway estimate ${polledEstimate} credits exceeds approved ceiling ${maxCredits}`);
    }
    if (TERMINAL_RUNWAY_STATES.has(task.status)) {
      if (task.status !== "SUCCEEDED" || !Array.isArray(task.output) || !task.output[0]) {
        throw new Error(task.failure || `Runway task ended ${task.status}`);
      }
      return task;
    }
    await sleep(pollMs);
  }
  await cancelRunwayTask(fetchImpl, env, created.id);
  throw new Error("Runway task timed out and was cancelled");
}

async function storeResponse(response, request, extension, env) {
  if (!response.ok || !response.body) throw new Error(`artifact download failed: HTTP ${response.status}`);
  const directory = path.resolve(asText(env.EDITFORGE_PROVIDER_ARTIFACT_DIR) || "/provider-artifacts");
  await fs.mkdir(directory, { recursive: true });
  const safeCommand = asText(request.commandId).replace(/[^A-Za-z0-9._-]/g, "-") || "command";
  const safeOperation = asText(request.operation?.id).replace(/[^A-Za-z0-9._-]/g, "-") || "operation";
  const actualExtension = contentTypeExtension(response.headers.get("content-type"), extension);
  const filename = `${safeCommand}-${safeOperation}-${Date.now()}${actualExtension}`;
  const destination = path.join(directory, filename);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  const sha256 = await hashFile(destination);
  const base = asText(env.EDITFORGE_PROVIDER_ARTIFACT_BASE_URL).replace(/\/$/, "");
  if (!base) throw new Error("EDITFORGE_PROVIDER_ARTIFACT_BASE_URL is required");
  return {
    uri: `${base}/${encodeURIComponent(filename)}`,
    sha256,
    mediaType: response.headers.get("content-type")?.split(";")[0] || mediaTypeForExtension(actualExtension),
  };
}

async function storeRemoteArtifact(fetchImpl, uri, request, fallbackExtension, env) {
  const response = await fetchImpl(uri, {
    redirect: "follow",
    signal: AbortSignal.timeout(MEDIA_TRANSFER_TIMEOUT_MS),
  });
  return storeResponse(response, request, fallbackExtension, env);
}

async function mediaAsDataUri(fetchImpl, uri, expectedPrefix) {
  if (asText(uri).startsWith("data:")) return uri;
  const response = await fetchImpl(uri, {
    redirect: "follow",
    signal: AbortSignal.timeout(MEDIA_TRANSFER_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`media download failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_INLINE_MEDIA_BYTES) throw new Error("media exceeds Runway's 16MB inline limit");
  const contentType = response.headers.get("content-type")?.split(";")[0] || expectedPrefix;
  if (!contentType.startsWith(expectedPrefix.split("/")[0] + "/")) throw new Error(`expected ${expectedPrefix} media`);
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function synthesizeVoice(request, identity, fetchImpl, env) {
  const voiceId = asText(identity.providers?.elevenlabsVoiceId);
  const apiKey = asText(env.ELEVENLABS_API_KEY);
  const text = asText(request.operation?.params?.text);
  const hostLimit = finite(env.EDITFORGE_VOICE_MAX_CHARACTERS_PER_JOB) || 5000;
  const approvedLimit = finite(request.operation?.params?.maxCharacters);
  if (!voiceId || !apiKey) throw new Error("canonical ElevenLabs voice id and ELEVENLABS_API_KEY are required");
  if (!text) throw new Error("operation.params.text is required");
  if (approvedLimit === null || approvedLimit <= 0) throw new Error("operation.params.maxCharacters is required");
  if (text.length > Math.min(hostLimit, approvedLimit)) throw new Error("script exceeds the approved character ceiling");
  const settings = request.operation?.params?.voiceSettings || {};
  const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: asText(request.operation?.params?.modelId) || "eleven_multilingual_v2",
      voice_settings: {
        stability: clamp(finite(settings.stability) ?? 0.5, 0, 1),
        similarity_boost: clamp(finite(settings.similarityBoost) ?? 0.8, 0, 1),
        style: clamp(finite(settings.style) ?? 0, 0, 1),
        use_speaker_boost: settings.useSpeakerBoost !== false,
      },
    }),
    signal: AbortSignal.timeout(MEDIA_TRANSFER_TIMEOUT_MS),
  });
  return storeResponse(response, request, ".mp3", env);
}

function outputRatio(request) {
  const explicit = asText(request.operation?.params?.ratio);
  if (["1280:720", "720:1280", "960:960", "1104:832", "832:1104", "1584:672"].includes(explicit)) return explicit;
  const width = Number(request.output?.width);
  const height = Number(request.output?.height);
  return height > width ? "720:1280" : height === width ? "960:960" : "1280:720";
}

async function generateMotion(request, identity, fetchImpl, env) {
  const characterFile = asText(identity.providers?.runwayCharacterFile);
  const characterUri = characterFile
    ? await privateImageAsDataUri(characterFile, env)
    : asText(identity.providers?.runwayCharacterUri);
  const characterType = identity.providers?.runwayCharacterType === "video" ? "video" : "image";
  const performanceUri = asText(request.operation?.params?.performanceUri);
  if (characterFile && characterType !== "image") throw new Error("local Runway character file must be an image");
  if (!characterUri) throw new Error("canonical Runway character URI or private file is required");
  if (!performanceUri) throw new Error("operation.params.performanceUri is required for full motion");
  const maxCredits = operationBudget(request.operation, env);
  const task = await runRunwayTask(fetchImpl, env, "character_performance", {
    model: "act_two",
    character: { type: characterType, uri: characterUri },
    reference: { type: "video", uri: performanceUri },
    bodyControl: request.operation?.params?.bodyControl !== false,
    expressionIntensity: clamp(finite(request.operation?.params?.expressionIntensity) || 3, 1, 5),
    ratio: outputRatio(request),
  }, maxCredits);
  return storeRemoteArtifact(fetchImpl, task.output[0], request, ".mp4", env);
}

async function generateLipSync(request, identity, fetchImpl, env) {
  const avatarId = asText(identity.providers?.runwayAvatarId);
  if (!avatarId) throw new Error("canonical Runway avatar id is required");
  const maxCredits = operationBudget(request.operation, env);
  let speech;
  const text = asText(request.operation?.params?.text);
  if (text) {
    const runwayVoiceId = asText(identity.providers?.runwayVoiceId);
    if (!runwayVoiceId) throw new Error("canonical Runway voice id is required for text-driven lip sync");
    speech = { type: "text", text, voice: { type: "custom", id: runwayVoiceId } };
  } else {
    const audioUri = asText(request.operation?.params?.audioUri) || asText(request.input?.uri);
    if (!audioUri) throw new Error("audio input is required for lip sync");
    speech = { type: "audio", audio: await mediaAsDataUri(fetchImpl, audioUri, "audio/mpeg") };
  }
  const task = await runRunwayTask(fetchImpl, env, "avatar_videos", {
    model: "gwm1_avatars",
    avatar: { type: "custom", avatarId },
    speech,
  }, maxCredits);
  return storeRemoteArtifact(fetchImpl, task.output[0], request, ".mp4", env);
}

async function executeProvider(pathname, request, fetchImpl, env) {
  const identity = await resolveIdentity(request, env);
  if (pathname === "/v1/voice") return synthesizeVoice(request, identity, fetchImpl, env);
  if (pathname === "/v1/motion") return generateMotion(request, identity, fetchImpl, env);
  if (pathname === "/v1/lipsync") return generateLipSync(request, identity, fetchImpl, env);
  throw new Error("unknown provider route");
}

async function serveArtifact(pathname, res, env) {
  const encodedName = pathname.slice("/artifacts/".length);
  const name = decodeURIComponent(encodedName);
  if (!name || name !== path.basename(name)) return respond(res, 404, { error: "artifact not found" });
  const directory = path.resolve(asText(env.EDITFORGE_PROVIDER_ARTIFACT_DIR) || "/provider-artifacts");
  const filename = path.join(directory, name);
  try {
    const stat = await fs.stat(filename);
    const extension = path.extname(name).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mediaTypeForExtension(extension),
      "Content-Length": stat.size,
      "Cache-Control": "private, max-age=31536000, immutable",
    });
    createReadStream(filename).pipe(res);
  } catch {
    respond(res, 404, { error: "artifact not found" });
  }
}

export function createProviderServer(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const token = asText(env.EDITFORGE_PROVIDER_TOKEN);
  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url || "/", "http://provider").pathname;
    if (req.method === "GET" && pathname === "/health") {
      let registryReady = false;
      try {
        await identityRegistry(env);
        registryReady = true;
      } catch {
        registryReady = false;
      }
      const ready = registryReady && Boolean(token);
      return respond(res, ready ? 200 : 503, {
        status: ready ? "ready" : "configuration_required",
        registryReady,
        elevenLabsConfigured: Boolean(asText(env.ELEVENLABS_API_KEY)),
        runwayConfigured: Boolean(asText(env.RUNWAYML_API_SECRET)),
      });
    }
    if (req.method === "GET" && pathname.startsWith("/artifacts/")) return serveArtifact(pathname, res, env);
    if (req.method !== "POST" || !["/v1/voice", "/v1/motion", "/v1/lipsync"].includes(pathname)) {
      return respond(res, 404, { error: "not found" });
    }
    const supplied = asText(req.headers.authorization).replace(/^Bearer\s+/i, "");
    if (!safeEqual(supplied, token)) return respond(res, 401, { error: "unauthorized" });
    try {
      const request = await readBody(req);
      const artifact = await executeProvider(pathname, request, fetchImpl, env);
      respond(res, 200, { artifact });
    } catch (error) {
      respond(res, 422, { error: error.message });
    }
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const port = Number(process.env.PORT || 9080);
  const host = process.env.HOST || "0.0.0.0";
  createProviderServer().listen(port, host, () => {
    process.stdout.write(`EditForge provider adapter listening on ${host}:${port}\n`);
  });
}
