import assert from "node:assert/strict";
import test from "node:test";
import { crc32, readZip, writeZip } from "./zip-store.ts";
import { safeStorage } from "./safe-storage.ts";

test("CRC agrees with the standard vector and a stored ZIP restores exact media bytes", async () => {
  assert.equal(await crc32(new Blob(["123456789"])), 0xcbf43926);
  const data = Uint8Array.from({ length: 16384 }, (_, i) => i % 251);
  const zip = await writeZip([{ path: "project.json", blob: new Blob(['{"fps":30}']) }, { path: "media/source", blob: new Blob([data]) }]);
  const restored = await readZip(zip);
  assert.equal(await restored.get("project.json")!.text(), '{"fps":30}');
  assert.deepEqual(new Uint8Array(await restored.get("media/source")!.arrayBuffer()), data);
});

test("damaged, truncated, duplicate and traversal ZIPs are refused", async () => {
  await assert.rejects(writeZip([{ path: "../source", blob: new Blob(["x"]) }]));
  await assert.rejects(writeZip([{ path: "x", blob: new Blob(["a"]) }, { path: "x", blob: new Blob(["b"]) }]));
  const zip = await writeZip([{ path: "media/a", blob: new Blob(["original"]) }]);
  await assert.rejects(readZip(zip.slice(0, zip.size - 1)));
  const corrupt = new Uint8Array(await zip.arrayBuffer());
  corrupt[37] ^= 1;
  await assert.rejects(readZip(new Blob([corrupt])), /checksum/);
});

test("a quota failure preserves the last saved project and reports unsaved state", () => {
  let actual = "previous-project";
  let full = true;
  let warning: string | null = null;
  const storage = safeStorage({ getItem: () => actual, setItem: (_, value) => { if (full) throw new Error("QuotaExceededError"); actual = value; }, removeItem: () => { actual = ""; } }, (message) => { warning = message; });
  storage.setItem("vela", "new-project");
  assert.equal(actual, "previous-project");
  assert.match(warning!, /NOT saved/);
  full = false;
  storage.setItem("vela", "new-project");
  assert.equal(actual, "new-project");
  assert.equal(warning, null);
});

test("a failed read blocks a write rather than replacing an unreadable saved project", () => {
  let writes = 0;
  const storage = safeStorage({ getItem: () => { throw new Error("SecurityError"); }, setItem: () => { writes += 1; }, removeItem: () => { writes += 1; } }, () => {});
  assert.equal(storage.getItem("vela"), null);
  storage.setItem("vela", "seed-project");
  storage.removeItem("vela");
  assert.equal(writes, 0);
});
