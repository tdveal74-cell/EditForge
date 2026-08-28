import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createProviderServer } from "./server.mjs";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "editforge-provider-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const characterFile = path.join(root, "tee-runway.png");
  await fs.writeFile(characterFile, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]));
  const registryFile = path.join(root, "identities.json");
  await fs.writeFile(registryFile, JSON.stringify({
    schema: "editforge.identity-registry.v1",
    identities: [{
      id: "tee-identity-v1",
      cloneId: "tee-clone-v1",
      voiceId: "tee-voice-v1",
      properties: ["tqo", "nco-forge"],
      consentRecorded: true,
      providers: {
        elevenlabsVoiceId: "eleven-tee",
        runwayAvatarId: "123e4567-e89b-42d3-a456-426614174000",
        runwayVoiceId: "123e4567-e89b-42d3-a456-426614174001",
        runwayCharacterFile: characterFile,
        runwayCharacterType: "image",
      },
    }],
  }));
  const env = {
    EDITFORGE_PROVIDER_TOKEN: "adapter-secret",
    EDITFORGE_IDENTITY_REGISTRY_FILE: registryFile,
    EDITFORGE_PROVIDER_ARTIFACT_DIR: root,
    EDITFORGE_PROVIDER_ARTIFACT_BASE_URL: "http://provider:9080/artifacts",
    EDITFORGE_PROVIDER_SECRET_DIR: root,
    EDITFORGE_PROVIDER_MAX_CREDITS_PER_JOB: "100",
    EDITFORGE_VOICE_MAX_CHARACTERS_PER_JOB: "5000",
    ELEVENLABS_API_KEY: "eleven-secret",
    RUNWAYML_API_SECRET: "runway-secret",
    RUNWAY_API_BASE_URL: "https://runway.example/v1",
    RUNWAY_POLL_INTERVAL_MS: "250",
    RUNWAY_TASK_TIMEOUT_MS: "10000",
  };
  return { root, env };
}

function requestBody(overrides = {}) {
  return {
    commandId: "cmd-001",
    projectId: "project-001",
    property: "tqo",
    deliverable: "long-form",
    operation: { id: "voice-001", type: "synthesize-voice", params: { text: "Ready.", maxCharacters: 100 } },
    identity: { cloneId: "tee-clone-v1", voiceId: "tee-voice-v1", version: "tee-identity-v1", consentRecorded: true },
    canon: { version: "tqo-canon-v1", locked: true },
    input: { uri: "https://media.example/input.mp4", sha256: "a".repeat(64), mediaType: "video/mp4" },
    output: { width: 1920, height: 1080 },
    ...overrides,
  };
}

async function withServer(t, env, fetchImpl) {
  const server = createProviderServer({ env, fetchImpl });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test("voice adapter locks identity and stores hashed ElevenLabs output", async (t) => {
  const { env } = await fixture(t);
  const fetchImpl = async (url, init) => {
    assert.match(String(url), /elevenlabs\.io\/v1\/text-to-speech\/eleven-tee/);
    assert.equal(init.headers["xi-api-key"], "eleven-secret");
    return new Response(Buffer.from("voice-audio"), { status: 200, headers: { "content-type": "audio/mpeg" } });
  };
  const base = await withServer(t, env, fetchImpl);
  const response = await fetch(`${base}/v1/voice`, {
    method: "POST",
    headers: { Authorization: "Bearer adapter-secret", "Content-Type": "application/json" },
    body: JSON.stringify(requestBody()),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(body.artifact.uri, /^http:\/\/provider:9080\/artifacts\//);
  assert.match(body.artifact.sha256, /^[a-f0-9]{64}$/);
  assert.equal(body.artifact.mediaType, "audio/mpeg");
});

test("adapter refuses Tee identity inside TSWS", async (t) => {
  const { env } = await fixture(t);
  const base = await withServer(t, env, async () => { throw new Error("provider must not be called"); });
  const response = await fetch(`${base}/v1/voice`, {
    method: "POST",
    headers: { Authorization: "Bearer adapter-secret", "Content-Type": "application/json" },
    body: JSON.stringify(requestBody({ property: "tsws" })),
  });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.match(body.error, /not authorized for tsws/);
});

test("motion adapter enforces approved credits and polls Runway", async (t) => {
  const { env } = await fixture(t);
  const calls = [];
  let motionPayload;
  const fetchImpl = async (url, init = {}) => {
    calls.push([String(url), init.method || "GET"]);
    if (String(url).endsWith("/character_performance")) {
      motionPayload = JSON.parse(init.body);
      return Response.json({ id: "task-1", estimatedCost: { credits: 25 } });
    }
    if (String(url).endsWith("/tasks/task-1")) {
      return Response.json({ id: "task-1", status: "SUCCEEDED", output: ["https://cdn.example/motion.mp4"], cost: { credits: 25 } });
    }
    if (String(url) === "https://cdn.example/motion.mp4") {
      return new Response(Buffer.from("motion-video"), { headers: { "content-type": "video/mp4" } });
    }
    throw new Error(`unexpected ${url}`);
  };
  const base = await withServer(t, env, fetchImpl);
  const response = await fetch(`${base}/v1/motion`, {
    method: "POST",
    headers: { Authorization: "Bearer adapter-secret", "Content-Type": "application/json" },
    body: JSON.stringify(requestBody({
      operation: { id: "motion-001", type: "generate-full-motion", params: { performanceUri: "https://media.example/performance.mp4", maxCredits: 30 } },
    })),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.artifact.mediaType, "video/mp4");
  assert.equal(motionPayload.character.type, "image");
  assert.match(motionPayload.character.uri, /^data:image\/png;base64,/);
  assert.deepEqual(calls.slice(0, 2), [
    ["https://runway.example/v1/character_performance", "POST"],
    ["https://runway.example/v1/tasks/task-1", "GET"],
  ]);
});

test("motion adapter refuses a local identity reference outside the secret directory", async (t) => {
  const { env } = await fixture(t);
  const registry = JSON.parse(await fs.readFile(env.EDITFORGE_IDENTITY_REGISTRY_FILE, "utf8"));
  registry.identities[0].providers.runwayCharacterFile = "/tmp/not-a-provider-secret.png";
  await fs.writeFile(env.EDITFORGE_IDENTITY_REGISTRY_FILE, JSON.stringify(registry));
  const base = await withServer(t, env, async () => { throw new Error("provider must not be called"); });
  const response = await fetch(`${base}/v1/motion`, {
    method: "POST",
    headers: { Authorization: "Bearer adapter-secret", "Content-Type": "application/json" },
    body: JSON.stringify(requestBody({
      operation: { id: "motion-private", type: "generate-full-motion", params: { performanceUri: "https://media.example/performance.mp4", maxCredits: 30 } },
    })),
  });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.match(body.error, /inside the provider secret directory/);
});

test("paid generation requires an explicit per-operation ceiling", async (t) => {
  const { env } = await fixture(t);
  const base = await withServer(t, env, async () => { throw new Error("provider must not be called"); });
  const response = await fetch(`${base}/v1/motion`, {
    method: "POST",
    headers: { Authorization: "Bearer adapter-secret", "Content-Type": "application/json" },
    body: JSON.stringify(requestBody({
      operation: { id: "motion-001", type: "generate-full-motion", params: { performanceUri: "https://media.example/performance.mp4" } },
    })),
  });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.match(body.error, /maxCredits is required/);
});

test("lip-sync adapter uses generated audio without substituting the avatar", async (t) => {
  const { env } = await fixture(t);
  let avatarPayload;
  const fetchImpl = async (url, init = {}) => {
    if (String(url) === "http://provider:9080/artifacts/voice.mp3") {
      return new Response(Buffer.from("voice-audio"), { headers: { "content-type": "audio/mpeg" } });
    }
    if (String(url).endsWith("/avatar_videos")) {
      avatarPayload = JSON.parse(init.body);
      return Response.json({ id: "task-avatar" });
    }
    if (String(url).endsWith("/tasks/task-avatar")) {
      return Response.json({ id: "task-avatar", status: "SUCCEEDED", output: ["https://cdn.example/avatar.mp4"], cost: { credits: 20 } });
    }
    if (String(url) === "https://cdn.example/avatar.mp4") {
      return new Response(Buffer.from("avatar-video"), { headers: { "content-type": "video/mp4" } });
    }
    throw new Error(`unexpected ${url}`);
  };
  const base = await withServer(t, env, fetchImpl);
  const response = await fetch(`${base}/v1/lipsync`, {
    method: "POST",
    headers: { Authorization: "Bearer adapter-secret", "Content-Type": "application/json" },
    body: JSON.stringify(requestBody({
      operation: { id: "lipsync-001", type: "lip-sync", params: { maxCredits: 30 } },
      input: { uri: "http://provider:9080/artifacts/voice.mp3", sha256: "b".repeat(64), mediaType: "audio/mpeg" },
    })),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(avatarPayload.avatar, { type: "custom", avatarId: "123e4567-e89b-42d3-a456-426614174000" });
  assert.equal(avatarPayload.speech.type, "audio");
  assert.match(avatarPayload.speech.audio, /^data:audio\/mpeg;base64,/);
});

test("adapter cancels when a polled Runway estimate exceeds approval", async (t) => {
  const { env } = await fixture(t);
  let cancelled = false;
  const fetchImpl = async (url, init = {}) => {
    if (String(url).endsWith("/character_performance")) return Response.json({ id: "task-over" });
    if (String(url).endsWith("/tasks/task-over") && (init.method || "GET") === "GET") {
      return Response.json({ id: "task-over", status: "PENDING", estimatedCost: { credits: 80 } });
    }
    if (String(url).endsWith("/tasks/task-over") && init.method === "DELETE") {
      cancelled = true;
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected ${url}`);
  };
  const base = await withServer(t, env, fetchImpl);
  const response = await fetch(`${base}/v1/motion`, {
    method: "POST",
    headers: { Authorization: "Bearer adapter-secret", "Content-Type": "application/json" },
    body: JSON.stringify(requestBody({
      operation: { id: "motion-over", type: "generate-full-motion", params: { performanceUri: "https://media.example/performance.mp4", maxCredits: 30 } },
    })),
  });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.match(body.error, /exceeds approved ceiling/);
  assert.equal(cancelled, true);
});
