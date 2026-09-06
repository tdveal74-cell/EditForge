import { describe, expect, it } from "vitest";
import { newProject, parseProject, studioTimeline, topologicalNodes } from "./model";
import { classifyUpload } from "./files";
import { parseAgentReply } from "./agent";

describe("Canvas project model", () => {
  it("ships a connected micro-drama workflow", () => {
    const project = newProject("micro-drama", "A courier arrives with a letter.");
    expect(project.templateId).toBe("micro-drama");
    expect(project.nodes.map((node) => node.kind)).toEqual(
      expect.arrayContaining(["prompt", "style", "image", "video", "voice", "output"]),
    );
    expect(topologicalNodes(project)).toHaveLength(project.nodes.length);
    expect(project.nodes.find((node) => node.kind === "prompt")?.prompt).toContain("courier");
  });

  it("rejects cycles and unsafe asset URLs", () => {
    const project = newProject("film");
    const [first, second] = project.nodes;
    expect(() =>
      parseProject({
        ...project,
        edges: [
          { id: "one", from: first.id, to: second.id },
          { id: "two", from: second.id, to: first.id },
        ],
      }),
    ).toThrow(/cycle/);
    expect(() =>
      parseProject({
        ...project,
        assets: [{ ...project.assets[0], url: "javascript:alert(1)" }],
      }),
    ).toThrow(/media library/);
  });

  it("places dialogue over the preceding picture instead of extending it", () => {
    const project = newProject("micro-drama");
    const still = project.assets[0];
    project.assets.push({ ...still, id: "voice", kind: "audio", title: "Dialogue" });
    project.clips = [
      { id: "picture", assetId: still.id, label: "Picture", duration: 6 },
      { id: "voice", assetId: "voice", label: "Dialogue", duration: 4 },
    ];
    const timeline = studioTimeline(project);
    expect(timeline[0]).toMatchObject({ track: "video", startSec: 0 });
    expect(timeline[1]).toMatchObject({ track: "vo", startSec: 0 });
  });
});

describe("Canvas input boundaries", () => {
  it("keeps archives and documents as sealed files", () => {
    expect(classifyUpload("production.zip").kind).toBe("file");
    expect(classifyUpload("notes.md").kind).toBe("file");
    expect(classifyUpload("dialogue.wav").kind).toBe("audio");
    expect(() => classifyUpload("payload.exe")).toThrow(/Unsupported/);
  });

  it("strips model attempts to mint completed media from a plan", () => {
    const project = newProject("micro-drama");
    const response = parseAgentReply(
      {
        reply: "Review this plan.",
        action: "plan",
        nodes: [
          {
            id: "brief",
            kind: "prompt",
            title: "Brief",
            prompt: "A held exchange.",
            aspectRatio: "9:16",
            assetUrl: "https://invented.invalid/master.mp4",
            status: "done",
          },
          {
            id: "output",
            kind: "output",
            title: "Output",
            prompt: "Human review.",
            aspectRatio: "9:16",
          },
        ],
        edges: [{ from: "brief", to: "output" }],
      },
      project,
    );
    expect(response.nodes?.every((node) => node.status === "idle")).toBe(true);
    expect(response.nodes?.every((node) => node.assetUrl === undefined)).toBe(true);
  });
});
