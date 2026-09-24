import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Own data dir so this file does not race the other store-writing suites.
const DATA_DIR = path.join(process.cwd(), ".data-test-canvas-render-node");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { renderNode, renderPlan } = await import("./render");
const { saveProject } = await import("./server-store");
const { newProject } = await import("./model");

const saved = { ...process.env };
const STILL = "https://dnznrvs05pmza.cloudfront.net/canvas-still.png";

beforeAll(async () => {
  await fs.rm(DATA_DIR, { recursive: true, force: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
});
afterAll(async () => {
  process.env = { ...saved, EDITFORGE_DATA_DIR: DATA_DIR };
  await fs.rm(DATA_DIR, { recursive: true, force: true });
});

async function setup(withStill: boolean) {
  process.env.RUNWAY_API_KEY = "tok";
  // A presenter file on disk must never reach a Canvas clip.
  const presenter = path.join(DATA_DIR, "tee.png");
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(presenter, new Uint8Array([1, 2, 3, 4]));
  process.env.EDITFORGE_RUNWAY_CHARACTER_FILE = presenter;
  const p = newProject("film");
  p.nodes = [
    { id: "still", kind: "image", x: 0, y: 0, title: "Still", prompt: "a lighthouse", aspectRatio: "16:9", status: "done", assetUrl: STILL },
    { id: "shot", kind: "video", x: 0, y: 0, title: "Shot", prompt: "slow push in", aspectRatio: "16:9", status: "idle", duration: 6 },
  ];
  p.edges = withStill ? [{ id: "e1", from: "still", to: "shot" }] : [];
  return saveProject(p);
}

function stubRunway() {
  const f = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    ({ ok: true, json: async () => ({ id: "task-canvas" }) }) as unknown as Response,
  );
  vi.stubGlobal("fetch", f);
  return f;
}

describe("renderNode sends Canvas motion to Runway", () => {
  it("animates the connected Canvas still, not the presenter file", async () => {
    const p = await setup(true);
    const f = stubRunway();
    const plan = renderPlan(p, ["shot"]);
    expect(plan.items[0].ready).toBe(true);
    await renderNode(p.id, ["shot"], plan.confirmation, false);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0][0])).toBe("https://api.dev.runwayml.com/v1/image_to_video");
    const body = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(body.promptImage).toBe(STILL);
    expect(body).toMatchObject({ model: "gen4.5", ratio: "1280:720", duration: 6 });
  });

  it("sends an unconnected shot as text to video", async () => {
    const p = await setup(false);
    const f = stubRunway();
    const plan = renderPlan(p, ["shot"]);
    await renderNode(p.id, ["shot"], plan.confirmation, false);
    expect(String(f.mock.calls[0][0])).toBe("https://api.dev.runwayml.com/v1/text_to_video");
    const body = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(body).not.toHaveProperty("promptImage");
  });
});
