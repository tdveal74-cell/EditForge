import {
  assetsFromTemplate,
  clipsFromTemplate,
  templateById,
} from "./templates";
import {
  ASPECT_OPTIONS,
  NODE_KIND_LABEL,
  type GraphNode,
  type Project,
} from "./types";
import type { TimelineClip as StudioClip } from "@/lib/timeline";

export function newProject(templateId = "film", brief?: string): Project {
  const t = templateById(templateId);
  const nodes = t.nodes.map((n) => ({ ...n }));
  if (brief?.trim()) {
    const target = nodes.find((n) => n.kind === "prompt");
    if (target) target.prompt = brief.trim().slice(0, 6000);
  }
  return {
    id: crypto.randomUUID(),
    name: t.name,
    templateId: t.id,
    nodes,
    edges: t.edges.map((e) => ({ ...e })),
    assets: assetsFromTemplate(t),
    clips: clipsFromTemplate(t),
    updatedAt: Date.now(),
    revision: 0,
    messages: [],
  };
}

export function safeAssetUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 3000) return false;
  if (/^\/(canvas\/stills|media|api\/artifacts)\/[A-Za-z0-9._-]+$/.test(value))
    return true;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function parseProject(value: unknown): Project {
  if (!value || typeof value !== "object")
    throw new Error("A project is required.");
  const p = value as Project;
  if (
    !/^[a-zA-Z0-9-]{3,80}$/.test(p.id) ||
    !p.name?.trim() ||
    p.name.length > 160
  )
    throw new Error("Invalid project name or id.");
  if (
    !Array.isArray(p.nodes) ||
    p.nodes.length > 60 ||
    !Array.isArray(p.edges) ||
    p.edges.length > 120
  )
    throw new Error("Limit each graph to 60 nodes and 120 connections.");
  const ids = new Set<string>();
  for (const n of p.nodes) {
    if (
      !n ||
      typeof n !== "object" ||
      !/^[A-Za-z0-9-]{1,80}$/.test(n.id) ||
      ids.has(n.id)
    )
      throw new Error("Each node needs a unique id.");
    ids.add(n.id);
    if (
      !Object.hasOwn(NODE_KIND_LABEL, n.kind) ||
      !ASPECT_OPTIONS.includes(n.aspectRatio) ||
      typeof n.title !== "string" ||
      !n.title.trim() ||
      n.title.length > 160 ||
      typeof n.prompt !== "string" ||
      n.prompt.length > 6000
    )
      throw new Error("Invalid node details.");
    if (![n.x, n.y].every((v) => Number.isFinite(v) && Math.abs(v) <= 30000))
      throw new Error("Invalid node position.");
    if (n.assetUrl && !safeAssetUrl(n.assetUrl))
      throw new Error("Use a studio asset or an HTTPS media URL.");
    if (
      n.duration !== undefined &&
      (!Number.isFinite(n.duration) || n.duration < 1 || n.duration > 15)
    )
      throw new Error("Shot duration must be 1 to 15 seconds.");
    if (n.voiceId && !/^[A-Za-z0-9_-]{1,100}$/.test(n.voiceId))
      throw new Error("Invalid voice id.");
  }
  const edgeIds = new Set<string>();
  for (const e of p.edges) {
    if (
      !e ||
      !ids.has(e.from) ||
      !ids.has(e.to) ||
      e.from === e.to ||
      edgeIds.has(e.id)
    )
      throw new Error("Connections must join two different, existing nodes.");
    edgeIds.add(e.id);
  }
  topologicalNodes(p);
  if (
    !Array.isArray(p.assets) ||
    p.assets.length > 120 ||
    p.assets.some(
      (a) =>
        !a ||
        !safeAssetUrl(a.url) ||
        !["image", "video", "audio", "file"].includes(a.kind),
    )
  )
    throw new Error("Invalid media library.");
  const assetIds = new Set(p.assets.map((a) => a.id));
  if (
    !Array.isArray(p.clips) ||
    p.clips.length > 120 ||
    p.clips.some(
      (c) =>
        !c ||
        !assetIds.has(c.assetId) ||
        !Number.isFinite(c.duration) ||
        c.duration < 0.1 ||
        c.duration > 600 ||
        typeof c.label !== "string",
    )
  )
    throw new Error("Invalid cut sequence.");
  if (!Number.isInteger(p.revision ?? 0) || (p.revision ?? 0) < 0)
    throw new Error("Invalid project revision.");
  return { ...p, updatedAt: Date.now() };
}

export function topologicalNodes(
  p: Pick<Project, "nodes" | "edges">,
): GraphNode[] {
  const out: GraphNode[] = [];
  const pending = [...p.nodes];
  while (pending.length) {
    const next = pending.findIndex((n) =>
      p.edges.every((e) => e.to !== n.id || out.some((x) => x.id === e.from)),
    );
    if (next < 0)
      throw new Error(
        "This connection creates a cycle. Keep the workflow moving toward Output.",
      );
    out.push(...pending.splice(next, 1));
  }
  return out;
}

export function generationNodes(p: Project) {
  return topologicalNodes(p).filter((n) =>
    ["image", "video", "voice"].includes(n.kind),
  );
}

export function connectedContext(p: Project, node: GraphNode): string {
  const parents = p.edges
    .filter((e) => e.to === node.id)
    .map((e) => p.nodes.find((n) => n.id === e.from));
  const reference = parents
    .filter((n) => n && ["prompt", "style"].includes(n.kind))
    .map((n) => n!.prompt)
    .join("\n");
  return node.kind === "voice"
    ? node.prompt
    : [reference, node.prompt].filter(Boolean).join("\n\n").slice(0, 12000);
}

export function studioTimeline(p: Project): StudioClip[] {
  let at = 0;
  let pictureStart = 0;
  return p.clips.map((c) => {
    const asset = p.assets.find((a) => a.id === c.assetId)!;
    const clip: StudioClip = {
      id: c.id,
      label: c.label,
      track: asset.kind === "audio" ? "vo" : "video",
      startSec: asset.kind === "audio" ? pictureStart : at,
      durationSec: c.duration,
    };
    if (clip.track === "video") {
      pictureStart = at;
      at += c.duration;
    }
    return clip;
  });
}
