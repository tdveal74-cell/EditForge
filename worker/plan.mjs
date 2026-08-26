const ADAPTER_TYPES = new Map([
  ["split", "EDITFORGE_TIMELINE_ADAPTER_URL"],
  ["reorder", "EDITFORGE_TIMELINE_ADAPTER_URL"],
  ["replace-shot", "EDITFORGE_TIMELINE_ADAPTER_URL"],
  ["title", "EDITFORGE_TIMELINE_ADAPTER_URL"],
  ["transition", "EDITFORGE_TIMELINE_ADAPTER_URL"],
  ["assemble-episode", "EDITFORGE_TIMELINE_ADAPTER_URL"],
  ["assemble-compilation", "EDITFORGE_TIMELINE_ADAPTER_URL"],
  ["synthesize-voice", "EDITFORGE_VOICE_ADAPTER_URL"],
  ["generate-full-motion", "EDITFORGE_MOTION_ADAPTER_URL"],
  ["lip-sync", "EDITFORGE_LIPSYNC_ADAPTER_URL"],
]);
const LOCAL_TYPES = new Set(["trim", "reframe", "derive-short", "speed", "audio-mix", "grade", "captions", "render-preview", "render-master"]);
const IDENTITY_TYPES = new Set(["synthesize-voice", "generate-full-motion", "lip-sync"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeFilterPath(value) {
  return value.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export function adapterEnvFor(type) {
  return ADAPTER_TYPES.get(type) || null;
}

export function validateWorkerCommand(command) {
  const issues = [];
  if (command?.schema !== "editforge.edit-command.v1") issues.push("edit command schema mismatch");
  if (command?.issuedBy !== "DEVON") issues.push("issuedBy must be DEVON");
  if (!["tqo", "nco-forge", "tsws", "ascension-caudex"].includes(command?.property)) issues.push("property is invalid");
  if (!["long-form", "short-form", "micro-drama"].includes(command?.deliverable)) issues.push("deliverable is invalid");
  for (const field of ["commandId", "projectId", "cutId"]) {
    if (!ID_PATTERN.test(command?.[field] || "")) issues.push(`${field} is invalid`);
  }
  if (command?.canon?.locked !== true || !command?.canon?.version) issues.push("locked canon is required");
  if (!command?.source?.uri) issues.push("source URI is required");
  if (!/^[a-f0-9]{64}$/i.test(command?.source?.sha256 || "")) issues.push("source SHA-256 is required");
  if (!Array.isArray(command?.operations) || command.operations.length === 0) issues.push("operations are required");
  const scopes = new Set(command?.authorization?.scopes || []);
  const operationIds = new Set();
  for (const operation of command?.operations || []) {
    const operationId = operation?.id;
    if (!ID_PATTERN.test(operationId || "") || operationIds.has(operationId)) issues.push("operation ids must be valid and unique");
    operationIds.add(operationId);
    if (!LOCAL_TYPES.has(operation?.type) && !ADAPTER_TYPES.has(operation?.type)) {
      issues.push(`operation ${operation?.type || "unknown"} is unsupported`);
    }
    if (!operation?.type || (!scopes.has("edit:*") && !scopes.has(`edit:${operation.type}`))) {
      issues.push(`operation ${operation?.type || "unknown"} is not authorized`);
    }
  }
  if ((command?.operations || []).some((operation) => IDENTITY_TYPES.has(operation?.type))) {
    const identity = command?.identity;
    if (!identity?.cloneId || !identity?.voiceId || !identity?.version || identity?.consentRecorded !== true) {
      issues.push("locked consented clone and voice identity are required");
    }
  }
  if (!["preview", "master"].includes(command?.output?.mode) ||
      !["mp4", "mov"].includes(command?.output?.container) ||
      ![24, 25, 30].includes(command?.output?.fps) ||
      !Number.isInteger(command?.output?.width) || !Number.isInteger(command?.output?.height)) {
    issues.push("output contract is invalid");
  }
  return issues;
}

export function compileRenderPlan(command, paths) {
  if (!command || command.schema !== "editforge.edit-command.v1") throw new Error("edit command schema mismatch");
  if (!Array.isArray(command.operations) || command.operations.length === 0) throw new Error("operations required");
  if (!command.output || !Number.isInteger(command.output.width) || !Number.isInteger(command.output.height)) {
    throw new Error("valid output dimensions required");
  }

  const adapterSteps = [];
  const videoFilters = [];
  const audioFilters = [];
  let startSec = null;
  let durationSec = null;
  let reframed = false;

  for (const operation of command.operations) {
    const adapterEnv = adapterEnvFor(operation.type);
    if (adapterEnv) {
      adapterSteps.push({ operation, adapterEnv });
      continue;
    }
    const params = operation.params || {};
    if (operation.type === "trim") {
      startSec = clamp(finite(params.startSec, 0), 0, 86_400);
      durationSec = clamp(finite(params.durationSec, 0), 0.04, 43_200);
    } else if (operation.type === "reframe" || operation.type === "derive-short") {
      reframed = true;
      videoFilters.push(
        `scale=${command.output.width}:${command.output.height}:force_original_aspect_ratio=increase`,
        `crop=${command.output.width}:${command.output.height}`
      );
    } else if (operation.type === "speed") {
      const factor = clamp(finite(params.factor, 1), 0.5, 2);
      videoFilters.push(`setpts=${(1 / factor).toFixed(6)}*PTS`);
      audioFilters.push(`atempo=${factor.toFixed(6)}`);
    } else if (operation.type === "audio-mix") {
      const gainDb = clamp(finite(params.gainDb, 0), -24, 12);
      audioFilters.push(`volume=${gainDb.toFixed(2)}dB`);
    } else if (operation.type === "grade") {
      const exposure = clamp(finite(params.exposure, 0), -0.5, 0.5);
      const contrast = clamp(finite(params.contrast, 0), -0.5, 0.5) + 1;
      const saturation = clamp(finite(params.saturation, 0), -0.5, 0.5) + 1;
      videoFilters.push(`eq=brightness=${exposure.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`);
    } else if (operation.type === "captions") {
      if (!paths.captionPath) throw new Error("caption operation requires a materialized caption file");
      videoFilters.push(`subtitles='${escapeFilterPath(paths.captionPath)}'`);
    } else if (operation.type !== "render-preview" && operation.type !== "render-master") {
      throw new Error(`operation ${operation.type} has no execution implementation`);
    }
  }

  if (!reframed) {
    videoFilters.unshift(
      `scale=${command.output.width}:${command.output.height}:force_original_aspect_ratio=decrease`,
      `pad=${command.output.width}:${command.output.height}:(ow-iw)/2:(oh-ih)/2`
    );
  }

  const args = ["-y"];
  if (startSec !== null) args.push("-ss", String(startSec));
  args.push("-i", paths.inputPath);
  if (durationSec !== null) args.push("-t", String(durationSec));
  if (videoFilters.length) args.push("-vf", videoFilters.join(","));
  if (audioFilters.length) args.push("-af", audioFilters.join(","));
  args.push("-r", String(command.output.fps));

  if (command.output.container === "mov") {
    args.push("-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le", "-c:a", "pcm_s24le");
  } else {
    args.push("-c:v", "libx264", "-preset", command.output.mode === "master" ? "slow" : "medium", "-crf", command.output.mode === "master" ? "18" : "21");
    args.push("-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart");
  }
  args.push(paths.outputPath);

  return { adapterSteps, ffmpegArgs: args, videoFilters, audioFilters };
}
