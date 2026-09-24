import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderPlan } from "./render";
import { connectedContext, generationNodes, newProject } from "./model";
import { TEMPLATES } from "./templates";
import type { GraphNode, Project } from "./types";

const saved = { ...process.env };
beforeEach(() => {
  process.env.RUNWAY_API_KEY = "tok";
  process.env.ELEVENLABS_API_KEY = "tok";
  process.env.ELEVENLABS_VOICE_ID = "voice";
});
afterEach(() => {
  process.env = { ...saved };
});

function project(nodes: Partial<GraphNode>[], edges: [string, string][] = []): Project {
  const p = newProject("film");
  p.nodes = nodes.map((n, i) => ({
    id: `n${i}`,
    kind: "image",
    x: 0,
    y: 0,
    title: `Node ${i}`,
    prompt: "a lighthouse at dusk",
    aspectRatio: "16:9",
    status: "idle",
    ...n,
  })) as GraphNode[];
  p.edges = edges.map(([from, to], i) => ({ id: `e${i}`, from, to }));
  return p;
}

describe("Canvas renders stills and motion on Runway", () => {
  it("routes stills to runway-image, motion to runway and dialogue to ElevenLabs", () => {
    const p = project([
      { id: "still", kind: "image" },
      { id: "shot", kind: "video", duration: 6 },
      { id: "line", kind: "voice", prompt: "Hello." },
    ]);
    const plan = renderPlan(p, ["still", "shot", "line"]);
    const by = Object.fromEntries(plan.items.map((i) => [i.nodeId, i]));
    expect(by.still.provider).toBe("runway-image");
    expect(by.shot.provider).toBe("runway");
    expect(by.line.provider).toBe("elevenlabs");
    expect(by.still.ready).toBe(true);
    expect(by.shot.ready).toBe(true);
  });

  it("names the missing Runway key instead of the xAI one", () => {
    delete process.env.RUNWAY_API_KEY;
    process.env.XAI_API_KEY = "tok";
    const plan = renderPlan(project([{ id: "still" }]), ["still"]);
    expect(plan.items[0].ready).toBe(false);
    expect(plan.items[0].reason).toMatch(/RUNWAY_API_KEY/);
  });

  it("refuses a 3:2 still and a square or 4:3 shot before the confirmation", () => {
    const p = project([
      { id: "still", aspectRatio: "3:2" },
      { id: "square", kind: "video", aspectRatio: "1:1" },
      { id: "classic", kind: "video", aspectRatio: "4:3" },
    ]);
    const plan = renderPlan(p, ["still", "square", "classic"]);
    expect(plan.items.map((i) => i.ready)).toEqual([false, false, false]);
    expect(plan.items[0].reason).toMatch(/Runway stills render/);
    expect(plan.items[1].reason).toMatch(/16:9 or 9:16/);
  });

  it("renders square and 4:3 stills, which Runway has resolutions for", () => {
    const p = project([
      { id: "a", aspectRatio: "1:1" },
      { id: "b", aspectRatio: "4:3" },
      { id: "c", aspectRatio: "9:16" },
    ]);
    expect(renderPlan(p, ["a", "b", "c"]).items.every((i) => i.ready)).toBe(true);
  });

  it("refuses a shot outside Runway's 2 to 10 seconds", () => {
    const p = project([
      { id: "long", kind: "video", duration: 12 },
      { id: "short", kind: "video", duration: 1 },
      { id: "edge", kind: "video", duration: 10 },
    ]);
    const plan = renderPlan(p, ["long", "short", "edge"]);
    expect(plan.items.map((i) => i.ready)).toEqual([false, false, true]);
    expect(plan.items[0].reason).toMatch(/2 to 10 seconds/);
  });

  it("counts connected context against Runway's 1000 character prompt", () => {
    const p = project(
      [
        { id: "brief", kind: "prompt", prompt: "x".repeat(990) },
        { id: "still", prompt: "a lighthouse at dusk" },
      ],
      [["brief", "still"]],
    );
    const plan = renderPlan(p, ["still"]);
    expect(plan.items[0].ready).toBe(false);
    expect(plan.items[0].reason).toMatch(/1000 characters/);
  });

  it("keeps every built-in template renderable on Runway", () => {
    for (const t of TEMPLATES) {
      const p = newProject(t.id);
      for (const n of generationNodes(p).filter((x) => x.kind !== "voice")) {
        expect(connectedContext(p, n).length, `${t.id}/${n.id}`).toBeLessThanOrEqual(1000);
      }
    }
  });
});
