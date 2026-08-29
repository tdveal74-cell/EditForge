import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { localSourcePath } from "./local-source.mjs";

test("resolves private source URIs inside the configured read-only root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "editforge-worker-sources-"));
  await mkdir(path.join(root, "TSWS"));
  const filename = path.join(root, "TSWS", "scene one.mp4");
  await writeFile(filename, "source");
  assert.equal(
    await localSourcePath("editforge-source:///TSWS/scene%20one.mp4", { EDITFORGE_SOURCE_MEDIA_DIR: root }),
    filename
  );
});

test("refuses traversal outside the private source root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "editforge-worker-sources-"));
  await assert.rejects(
    localSourcePath("editforge-source:///%2e%2e%2Foutside.mp4", { EDITFORGE_SOURCE_MEDIA_DIR: root }),
    /escapes the source directory/
  );
});
