import assert from "node:assert/strict";
import test from "node:test";
import { remoteMediaUrl } from "./media-url.mjs";

test("production media policy allows only an explicit private adapter origin", () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    allowPrivate: process.env.EDITFORGE_ALLOW_PRIVATE_MEDIA_URLS,
    trusted: process.env.EDITFORGE_TRUSTED_MEDIA_ORIGINS,
  };
  process.env.NODE_ENV = "production";
  delete process.env.EDITFORGE_ALLOW_PRIVATE_MEDIA_URLS;
  process.env.EDITFORGE_TRUSTED_MEDIA_ORIGINS = "http://provider:9080";
  try {
    assert.equal(remoteMediaUrl("http://provider:9080/artifacts/output.mp4", "artifact").hostname, "provider");
    assert.throws(() => remoteMediaUrl("http://worker:8787/v1/jobs", "source"), /HTTPS/);
    assert.throws(() => remoteMediaUrl("http://127.0.0.1:8787/health", "source"), /HTTPS/);
    assert.equal(remoteMediaUrl("https://media.example/source.mp4", "source").protocol, "https:");
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.allowPrivate === undefined) delete process.env.EDITFORGE_ALLOW_PRIVATE_MEDIA_URLS;
    else process.env.EDITFORGE_ALLOW_PRIVATE_MEDIA_URLS = previous.allowPrivate;
    if (previous.trusted === undefined) delete process.env.EDITFORGE_TRUSTED_MEDIA_ORIGINS;
    else process.env.EDITFORGE_TRUSTED_MEDIA_ORIGINS = previous.trusted;
  }
});
