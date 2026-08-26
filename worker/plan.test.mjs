import test from "node:test";
import assert from "node:assert/strict";
import { compileRenderPlan, validateWorkerCommand } from "./plan.mjs";

function command() {
  return {
    schema: "editforge.edit-command.v1",
    commandId: "cmd-worker-001",
    projectId: "project-worker-001",
    cutId: "cut-worker-001",
    property: "tqo",
    deliverable: "short-form",
    issuedBy: "DEVON",
    source: { uri: "https://media.example/input.mp4", sha256: "a".repeat(64) },
    canon: { version: "tqo-worker-v1", locked: true },
    identity: { cloneId: "tee-clone-v1", voiceId: "tee-voice-v1", version: "tee-identity-v1", consentRecorded: true },
    authorization: { approvalId: "approval-worker-001", approvedBy: "Tee", scopes: ["edit:*"] },
    operations: [
      { id: "motion", type: "generate-full-motion", params: {} },
      { id: "trim", type: "trim", params: { startSec: 2, durationSec: 8 } },
      { id: "vertical", type: "reframe", params: { aspect: "9:16" } },
      { id: "mix", type: "audio-mix", params: { gainDb: -2 } },
    ],
    output: { mode: "preview", width: 1080, height: 1920, fps: 30, container: "mp4" },
  };
}

test("compiles full-motion adapter work and a deterministic vertical ffmpeg pass", () => {
  const plan = compileRenderPlan(command(), { inputPath: "/work/in.mp4", outputPath: "/work/out.mp4" });
  assert.equal(plan.adapterSteps[0].adapterEnv, "EDITFORGE_MOTION_ADAPTER_URL");
  assert.ok(plan.ffmpegArgs.includes("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"));
  assert.ok(plan.ffmpegArgs.some((arg) => arg.includes("-2.00dB")));
  assert.deepEqual(plan.ffmpegArgs.slice(-2), ["+faststart", "/work/out.mp4"]);
});

test("uses a mezzanine codec for mov masters", () => {
  const value = command();
  value.output = { mode: "master", width: 3840, height: 2160, fps: 24, container: "mov" };
  value.operations = [{ id: "master", type: "render-master", params: {} }];
  const plan = compileRenderPlan(value, { inputPath: "/work/in.mp4", outputPath: "/work/out.mov" });
  assert.ok(plan.ffmpegArgs.includes("prores_ks"));
  assert.ok(plan.ffmpegArgs.includes("pcm_s24le"));
  assert.ok(plan.ffmpegArgs.some((arg) => arg.includes("pad=3840:2160")));
});

test("routes nonlinear timeline edits to an explicit adapter", () => {
  const value = command();
  value.operations = [
    { id: "reorder", type: "reorder", params: { segments: ["c", "a", "b"] } },
    { id: "title", type: "title", params: { text: "Chapter One" } },
  ];
  const plan = compileRenderPlan(value, { inputPath: "/work/in.mp4", outputPath: "/work/out.mp4" });
  assert.deepEqual(plan.adapterSteps.map((step) => step.adapterEnv), [
    "EDITFORGE_TIMELINE_ADAPTER_URL",
    "EDITFORGE_TIMELINE_ADAPTER_URL",
  ]);
});

test("refuses an operation without a local compiler or adapter", () => {
  const value = command();
  value.operations = [{ id: "unknown", type: "not-real", params: {} }];
  assert.throws(
    () => compileRenderPlan(value, { inputPath: "/work/in.mp4", outputPath: "/work/out.mp4" }),
    /no execution implementation/
  );
});

test("refuses captions without a materialized caption file", () => {
  const value = command();
  value.operations = [{ id: "captions", type: "captions", params: { srtUri: "https://media.example/a.srt" } }];
  assert.throws(() => compileRenderPlan(value, { inputPath: "/work/in.mp4", outputPath: "/work/out.mp4" }), /caption file/);
});

test("worker independently refuses non-DEVON and unscoped commands", () => {
  const value = command();
  value.issuedBy = "someone-else";
  value.canon = { locked: true };
  value.source = { sha256: "a".repeat(64) };
  value.authorization = { scopes: ["edit:trim"] };
  const issues = validateWorkerCommand(value);
  assert.ok(issues.includes("issuedBy must be DEVON"));
  assert.ok(issues.some((issue) => issue.includes("generate-full-motion") && issue.includes("not authorized")));
});

test("worker accepts a complete DEVON-scoped command", () => {
  assert.deepEqual(validateWorkerCommand(command()), []);
});
