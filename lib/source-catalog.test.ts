import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listSourceAssets, sourceCatalogConfigured } from "./source-catalog";

describe("private source catalog", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns content hashes and private source URIs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "editforge-sources-"));
    await mkdir(path.join(root, "TSWS"));
    await writeFile(path.join(root, "TSWS", "scene one.mp4"), "locked-source");
    await writeFile(path.join(root, "notes.txt"), "not media");
    vi.stubEnv("EDITFORGE_SOURCE_MEDIA_DIR", root);

    expect(sourceCatalogConfigured()).toBe(true);
    await expect(listSourceAssets()).resolves.toEqual([
      expect.objectContaining({
        name: path.join("TSWS", "scene one.mp4"),
        uri: "editforge-source:///TSWS/scene%20one.mp4",
        sha256: "eba5b1ba677b0daeaa85c6f3f1151080edef51a9c85b28258f6acac0d00f3684",
        byteLength: 13,
      }),
    ]);
  });
});
