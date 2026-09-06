import type { GraphEdge, GraphNode, Project } from "./types";
import { ASPECT_OPTIONS } from "./types";
import { parseProject } from "./model";

export type AgentReply = {
  reply: string;
  action: "reply" | "plan" | "render" | "outputs";
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  nodeIds?: string[];
};
export function parseAgentReply(value: unknown, project: Project): AgentReply {
  if (!value || typeof value !== "object")
    throw new Error(
      "The agent did not return a valid response. No graph or job was changed.",
    );
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.reply !== "string" ||
    !raw.reply.trim() ||
    raw.reply.length > 12000
  )
    throw new Error(
      "The agent response was incomplete. No render was submitted.",
    );
  const action = raw.action;
  if (!["reply", "plan", "render", "outputs"].includes(String(action)))
    throw new Error("The agent proposed an unsupported action.");
  const reply: AgentReply = {
    reply: raw.reply,
    action: action as AgentReply["action"],
  };
  if (action === "render") {
    if (
      !Array.isArray(raw.nodeIds) ||
      !raw.nodeIds.length ||
      raw.nodeIds.length > 12 ||
      raw.nodeIds.some(
        (id) =>
          typeof id !== "string" ||
          !project.nodes.some(
            (n) => n.id === id && ["image", "video", "voice"].includes(n.kind),
          ),
      )
    )
      throw new Error(
        "The agent named a render node that is not in this graph.",
      );
    reply.nodeIds = [...new Set(raw.nodeIds as string[])];
  }
  if (action === "plan") {
    if (
      !Array.isArray(raw.nodes) ||
      raw.nodes.length < 1 ||
      raw.nodes.length > 30 ||
      !Array.isArray(raw.edges)
    )
      throw new Error("The agent plan exceeds the graph limit.");
    // Allow only creative input. The model cannot mint receipts, media URLs,
    // consent, approval, completed statuses, or saved project identifiers.
    const nodes: GraphNode[] = raw.nodes.map((n, i) => ({
      id: String(n.id ?? `scene-${i}`),
      kind: n.kind,
      title: n.title,
      prompt: n.prompt,
      aspectRatio: ASPECT_OPTIONS.includes(n.aspectRatio)
        ? n.aspectRatio
        : "9:16",
      duration: Number(n.duration ?? 6),
      voiceId: typeof n.voiceId === "string" ? n.voiceId : undefined,
      x: 60 + (i % 4) * 320,
      y: 60 + Math.floor(i / 4) * 310,
      status: "idle",
    }));
    const edges: GraphEdge[] = raw.edges.map((e, i) => ({
      id: `agent-edge-${i}`,
      from: String(e.from),
      to: String(e.to),
    }));
    parseProject({ ...project, nodes, edges, assets: [], clips: [] });
    reply.nodes = nodes;
    reply.edges = edges;
  }
  return reply;
}

export const FLOOR_SYSTEM = `You are EditForge's Floor Agent, a production assistant within Canvas. DEVON remains the executive orchestrator. You can discuss briefs, propose production graphs, request confirmed render jobs, inspect saved job receipts, and return actual outputs supplied in context. Use clear concise prose. Respect human creative review and existing canon. Do not invent rendered media, file links, job success, prices, consent, or final master approval. No paid render happens from this chat alone: a render action opens an exact confirmation. Motion with connected image needs that still rendered and accepted first. Voice uses an authorized ElevenLabs voice ID or the studio default. Do not promise automatic lip sync; it is a separate identity-approved lane. Your plan should be practical, specific and artistically restrained. Micro dramas need a hook, scene beats, continuity look, separate dialogue voice nodes, reference stills, short motion shots and a final output node. Preserve space for a held ending. Working examples are not canon. Return only JSON: {"reply":"...","action":"reply|plan|render|outputs","nodes":[{"id":"...","kind":"prompt|style|image|video|voice|output","title":"...","prompt":"...","aspectRatio":"9:16","duration":6}],"edges":[{"from":"...","to":"..."}],"nodeIds":["existing-id"]}. Include nodes/edges only for plan. Include nodeIds only for render. A plan replaces the graph after user acceptance; warn before replacing a graph with work. For outputs refer only to actual media listed in context; the application displays their verified links.`;
