import test from "node:test";
import assert from "node:assert/strict";
import { activeMediaAudio, audioGain, frameAt, isMediaAsset, mediaDuration, SH135_HASH, snapTime, SOURCE_FACTS, trackAudible, type MediaAsset, type Track } from "./media-model.ts";

test("30 fps retains all EP01 frame boundaries across the 20,877-frame cut", () => {
  for (let frame = 0; frame <= 20877; frame += 1) {
    assert.equal(frameAt(snapTime(frame / 30, 30), 30), frame);
  }
  for (const frame of [540, 900, 12902, 13022, 14918, 14978, 20877]) {
    assert.equal(snapTime(frame / 30, 30), frame / 30);
  }
});

test("24 fps sources map explicitly to repeated frames on a 30 fps timeline", () => {
  for (let frame = 0; frame < 20877; frame += 1) {
    assert.equal(frameAt(frame / 30, 24), Math.floor(frame * 4 / 5));
  }
  assert.equal(frameAt(29 / 30, 24), 23);
  assert.equal(frameAt(30 / 30, 24), 24);
});

test("a real source is not silently extended past its end when placed", () => {
  const asset = { kind: "video", duration: 145 / 24 } as MediaAsset;
  const length = mediaDuration(asset, 30);
  assert.equal(frameAt(length, 30), 181);
  assert.ok(length <= 145 / 24);
  assert.equal(frameAt(length - 1 / 30, 24), 144);
  assert.throws(() => mediaDuration({ kind: "video", duration: null } as MediaAsset, 30));
});

test("gain and two-frame fades have deterministic endpoint silence", () => {
  assert.equal(audioGain(0, 0, 1, 2 / 30, 2 / 30), 0);
  assert.equal(audioGain(0, 1, 1, 2 / 30, 2 / 30), 0);
  assert.ok(Math.abs(audioGain(-1.5, 0.5, 1) - 10 ** (-1.5 / 20)) < 1e-12);
  assert.equal(audioGain(0, 1 / 30, 1, 2 / 30), 0.5);
});

test("stream facts and the SH135 lock are tied to byte hashes rather than filenames", () => {
  assert.equal(SOURCE_FACTS["0e5710ac6c44d7ed53085ede2fb96700cbf4d296ec525bb070fd812f167fd02b"].hasAudio, false);
  assert.equal(SOURCE_FACTS["202086b308ebac48a65462371aa9521aa685ec4e1fdf122c3f267fc287e05fd5"].hasAudio, true);
  assert.equal(SH135_HASH, "0c82b6cfb118ae559e5ab49776dc10551f972fa21df0e5582c044e0d347cb310");
  assert.throws(() => snapTime(Infinity, 30));
  assert.throws(() => frameAt(1, 0));
});

test("imported media metadata refuses invalid timebases and detached proxy bindings", () => {
  const sha = "a".repeat(64);
  const asset: MediaAsset = { id: `media-${sha}`, sha256: sha, name: "source.mp4", mime: "video/mp4", kind: "video", bytes: 100,
    duration: 8, sourceFps: 24, hasAudio: false, locked: false };
  assert.equal(isMediaAsset(asset), true);
  assert.equal(isMediaAsset({ ...asset, sourceFps: 0 }), false);
  assert.equal(isMediaAsset({ ...asset, bytes: -1 }), false);
  assert.equal(isMediaAsset({ ...asset, id: "unrelated-source" }), false);
  const proxyHash = "b".repeat(64);
  const preview = { id: `media-${proxyHash}`, sha256: proxyHash, bytes: 50, mime: "video/webm", duration: 8, sourceSha256: sha };
  assert.equal(isMediaAsset({ ...asset, preview }), true);
  assert.equal(isMediaAsset({ ...asset, preview: { ...preview, sourceSha256: proxyHash } }), false);
});

test("hidden picture audio is excluded while independent audio respects solo", () => {
  const clips = [
    { id: "hidden-picture", mediaId: "old", track: 0 as Track, start: 0, duration: 8 },
    { id: "visible-picture", mediaId: "new", track: 0 as Track, start: 1, duration: 8 },
    { id: "independent-read", mediaId: "read", track: 3 as Track, start: 0, duration: 9 },
  ];
  assert.deepEqual(activeMediaAudio(clips, 3, "visible-picture").map((clip) => clip.id), ["visible-picture", "independent-read"]);
  assert.deepEqual(activeMediaAudio(clips, 3, "visible-picture", 3).map((clip) => clip.id), ["independent-read"]);
  assert.equal(trackAudible(2, 3), false);
  assert.equal(trackAudible(2, 2), true);
  assert.equal(trackAudible(2, null), true);
});
