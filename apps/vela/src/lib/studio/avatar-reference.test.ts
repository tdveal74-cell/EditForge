import assert from "node:assert/strict";
import test from "node:test";
import { decodeAvatarBundle, sha256, type AvatarBundle } from "./avatar-reference.ts";

async function fixture(): Promise<AvatarBundle> {
  const data = ["one original", "second original"];
  const hashes = await Promise.all(data.map((s) => sha256(new Blob([s]))));
  return {
    schema: "vela.avatar-reference/v1",
    profile: { id: "subject", name: "Supplied subject", revision: 1, selectedLookId: "look-1", looks: data.map((_, i) => ({
      id: `look-${i}`, name: `Look ${i}`, assetId: `input-${i}`, sha256: hashes[i], mime: "image/webp", width: 2752, height: 1536,
    })) },
    assets: data.map((s, i) => ({ id: `input-${i}`, mime: "image/webp", sha256: hashes[i], dataBase64: btoa(s) })),
  };
}

test("keeps selection order and exact source bytes, and namespaces imported IDs by hash", async () => {
  const bundle = await fixture();
  const result = await decodeAvatarBundle(bundle);
  assert.deepEqual(result.profile.looks.map((l) => l.id), ["look-0", "look-1"]);
  assert.equal(result.profile.selectedLookId, "look-1");
  assert.equal(await result.media[1].blob.text(), "second original");
  assert.equal(result.profile.looks[0].assetId, `avatar-${bundle.assets[0].sha256}`);
});

test("refuses a corrupted photo before returning any importable media", async () => {
  const bundle = await fixture();
  bundle.assets[1].dataBase64 = btoa("different bytes");
  await assert.rejects(decodeAvatarBundle(bundle), /checksum/);
});

test("refuses duplicate assets and missing or unknown selected looks", async () => {
  const bundle = await fixture();
  bundle.assets[1] = bundle.assets[0];
  await assert.rejects(decodeAvatarBundle(bundle), /payload/);
  const other = await fixture();
  other.profile.selectedLookId = "missing";
  await assert.rejects(decodeAvatarBundle(other), /selected look/);
});

test("refuses unsupported image MIME types and excessive dimensions", async () => {
  const bundle = await fixture();
  bundle.profile.looks[0].mime = "image/svg+xml";
  await assert.rejects(decodeAvatarBundle(bundle), /look/);
  const other = await fixture();
  other.profile.looks[0].width = 100000;
  await assert.rejects(decodeAvatarBundle(other), /look/);
});

test("refuses empty, oversized-count and invalid revision packs", async () => {
  await assert.rejects(decodeAvatarBundle({}), /Invalid/);
  const bundle = await fixture();
  bundle.profile.revision = 0;
  await assert.rejects(decodeAvatarBundle(bundle), /Invalid/);
  const other = await fixture();
  other.profile.looks = Array(21).fill(other.profile.looks[0]);
  await assert.rejects(decodeAvatarBundle(other), /Invalid/);
});
