import { previewPathPrefix } from "@/lib/preview-path-prefix";
import {
  dialogueToCaptions,
  extractBeats,
  extractDialogue,
  extractScenes,
  formatHeadings,
  projectDuration,
  tightenScript,
  wordCount,
  type Project,
} from "@/lib/studio/model";
import { useStudio } from "@/lib/studio/store";

export const MCP_PROTOCOL = "2025-03-26";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface McpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

interface Rpc {
  jsonrpc?: string;
  id?: unknown;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string };
}

export function apiPath(path: string): string {
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return prefix ? `${prefix}${path}` : path;
}

export function textResult(text: string, isError = false): McpToolResult {
  return { content: [{ type: "text", text }], isError };
}

function ok(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function fail(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

const SERVER_TOOLS: McpTool[] = [
  {
    name: "script_extract_scenes",
    description: "List INT and EXT scene headings from a screenplay.",
    inputSchema: {
      type: "object",
      properties: { script: { type: "string", description: "Screenplay text" } },
      required: ["script"],
    },
  },
  {
    name: "script_extract_dialogue",
    description: "Pull spoken lines that sit under a character cue.",
    inputSchema: {
      type: "object",
      properties: { script: { type: "string", description: "Screenplay text" } },
      required: ["script"],
    },
  },
  {
    name: "script_extract_beats",
    description: "Pull action lines for a story board.",
    inputSchema: {
      type: "object",
      properties: { script: { type: "string", description: "Screenplay text" } },
      required: ["script"],
    },
  },
  {
    name: "script_tighten",
    description: "Remove filler words from a script.",
    inputSchema: {
      type: "object",
      properties: { script: { type: "string", description: "Screenplay text" } },
      required: ["script"],
    },
  },
  {
    name: "script_format_headings",
    description: "Uppercase INT and EXT scene headings.",
    inputSchema: {
      type: "object",
      properties: { script: { type: "string", description: "Screenplay text" } },
      required: ["script"],
    },
  },
  {
    name: "script_to_captions",
    description: "Turn dialogue into timed caption cues.",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "Screenplay text" },
        duration: { type: "number", description: "Timeline length in seconds" },
      },
      required: ["script"],
    },
  },
  {
    name: "project_outline",
    description: "Summarize a script: word count, scenes, dialogue, and beats.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project title" },
        script: { type: "string", description: "Screenplay text" },
      },
      required: ["script"],
    },
  },
];

function scriptOf(params: unknown): string {
  if (!params || typeof params !== "object" || typeof (params as { script?: unknown }).script !== "string") {
    throw new Error("script is required");
  }
  return (params as { script: string }).script;
}

function callServerTool(name: string, args: unknown): McpToolResult {
  try {
    if (name === "script_extract_scenes") return textResult(JSON.stringify(extractScenes(scriptOf(args)), null, 2));
    if (name === "script_extract_dialogue") return textResult(JSON.stringify(extractDialogue(scriptOf(args)), null, 2));
    if (name === "script_extract_beats") return textResult(JSON.stringify(extractBeats(scriptOf(args)), null, 2));
    if (name === "script_tighten") return textResult(tightenScript(scriptOf(args)));
    if (name === "script_format_headings") return textResult(formatHeadings(scriptOf(args)));
    if (name === "script_to_captions") {
      const script = scriptOf(args);
      const duration = Number((args as { duration?: unknown }).duration ?? 12);
      return textResult(JSON.stringify(dialogueToCaptions(extractDialogue(script), duration), null, 2));
    }
    if (name === "project_outline") {
      const script = scriptOf(args);
      const name = typeof (args as { name?: unknown }).name === "string" ? (args as { name: string }).name : "Untitled";
      return textResult(
        JSON.stringify(
          {
            name,
            words: wordCount(script),
            scenes: extractScenes(script),
            dialogue: extractDialogue(script),
            beats: extractBeats(script),
          },
          null,
          2,
        ),
      );
    }
    return textResult(`Unknown tool ${name}`, true);
  } catch (error) {
    return textResult(error instanceof Error ? error.message : "Tool failed", true);
  }
}

export function handleMcpMessage(message: unknown): unknown | null {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return fail(null, -32600, "Invalid request");
  }
  const msg = message as Rpc;
  if (typeof msg.method !== "string") return fail(msg.id ?? null, -32600, "Invalid request");
  if (msg.id === undefined) return null;
  if (msg.method === "initialize") {
    return ok(msg.id, {
      protocolVersion: MCP_PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "vela", version: "1.0.0" },
      instructions:
        "Vela studio tools. Pass a screenplay in the script field. This endpoint does not see the browser project. Use the in-app This project server for the open edit.",
    });
  }
  if (msg.method === "ping") return ok(msg.id, {});
  if (msg.method === "tools/list") return ok(msg.id, { tools: SERVER_TOOLS });
  if (msg.method === "tools/call") {
    const params = msg.params as { name?: unknown; arguments?: unknown } | undefined;
    if (!params || typeof params.name !== "string") return fail(msg.id, -32602, "Tool name is required");
    return ok(msg.id, callServerTool(params.name, params.arguments ?? {}));
  }
  return fail(msg.id, -32601, `Method not found: ${msg.method}`);
}

export const LOCAL_TOOLS: McpTool[] = [
  {
    name: "vela_get_project",
    description: "Read the project open in this browser: script, clips, captions, board, and score.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vela_set_script",
    description: "Replace the open project's script.",
    inputSchema: {
      type: "object",
      properties: { script: { type: "string", description: "Full screenplay" } },
      required: ["script"],
    },
  },
  {
    name: "vela_append_script",
    description: "Append text to the open script.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Text to append" } },
      required: ["text"],
    },
  },
  {
    name: "vela_set_logline",
    description: "Set the open project's logline.",
    inputSchema: {
      type: "object",
      properties: { logline: { type: "string", description: "One-line story" } },
      required: ["logline"],
    },
  },
  {
    name: "vela_add_board_card",
    description: "Add a beat card to act 1, 2, or 3.",
    inputSchema: {
      type: "object",
      properties: {
        act: { type: "number", description: "1, 2, or 3" },
        title: { type: "string", description: "Beat title" },
        body: { type: "string", description: "What changes" },
      },
      required: ["title", "body"],
    },
  },
  {
    name: "vela_add_caption",
    description: "Add a caption at the playhead.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Spoken line" } },
      required: ["text"],
    },
  },
  {
    name: "vela_add_picture",
    description: "Append a picture clip to the cut.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Clip name" } },
      required: ["name"],
    },
  },
  {
    name: "vela_rebuild_from_script",
    description: "Rebuild the picture track, captions, and board from the open script.",
    inputSchema: { type: "object", properties: {} },
  },
];

function openProject(): Project {
  const state = useStudio.getState();
  return state.projects.find((project) => project.id === state.activeId) ?? state.projects[0]!;
}

export function callLocalTool(name: string, args: Record<string, unknown>): McpToolResult {
  const studio = useStudio.getState();
  try {
    if (name === "vela_get_project") {
      const project = openProject();
      return textResult(
        JSON.stringify(
          {
            name: project.name,
            logline: project.logline,
            aspect: project.aspect,
            preset: project.preset,
            duration: projectDuration(project),
            words: wordCount(project.script),
            bpm: project.score.bpm,
            clips: project.clips.map((clip) => ({
              name: clip.name,
              kind: clip.kind,
              start: clip.start,
              duration: clip.duration,
            })),
            captions: project.captions,
            board: project.board,
            titles: project.titles.map((title) => title.text),
            script: project.script,
          },
          null,
          2,
        ),
      );
    }
    if (name === "vela_set_script") {
      if (typeof args.script !== "string") return textResult("script is required", true);
      studio.setScript(args.script);
      return textResult("Script replaced.");
    }
    if (name === "vela_append_script") {
      if (typeof args.text !== "string" || !args.text.trim()) return textResult("text is required", true);
      const project = openProject();
      studio.setScript(`${project.script.replace(/\s*$/, "")}\n\n${args.text.trim()}\n`);
      return textResult("Appended to the script.");
    }
    if (name === "vela_set_logline") {
      if (typeof args.logline !== "string") return textResult("logline is required", true);
      studio.setLogline(args.logline);
      return textResult("Logline updated.");
    }
    if (name === "vela_add_board_card") {
      const act = args.act === 2 || args.act === 3 ? args.act : 1;
      if (typeof args.title !== "string" || typeof args.body !== "string") return textResult("title and body are required", true);
      studio.addCard(act);
      const card = openProject().board.at(-1);
      if (card) studio.updateCard(card.id, { title: args.title, body: args.body, act });
      return textResult(`Card added to act ${act}.`);
    }
    if (name === "vela_add_caption") {
      if (typeof args.text !== "string" || !args.text.trim()) return textResult("text is required", true);
      studio.addCaption();
      const caption = openProject().captions.at(-1);
      if (caption) studio.setCaptionText(caption.id, args.text.trim());
      return textResult("Caption added at the playhead.");
    }
    if (name === "vela_add_picture") {
      if (typeof args.name !== "string" || !args.name.trim()) return textResult("name is required", true);
      studio.addPicture();
      const id = useStudio.getState().selectedClipId;
      if (id) studio.setClipName(id, args.name.trim());
      studio.setRoom("mcp");
      return textResult("Picture clip added.");
    }
    if (name === "vela_rebuild_from_script") {
      studio.rebuildCut();
      studio.rebuildCaptions();
      studio.rebuildBoard();
      studio.setRoom("mcp");
      return textResult("Cut, captions, and board rebuilt from the script.");
    }
    return textResult(`Unknown tool ${name}`, true);
  } catch (error) {
    return textResult(error instanceof Error ? error.message : "Tool failed", true);
  }
}

export function sampleArgs(tool: McpTool): string {
  const properties = tool.inputSchema.properties ?? {};
  const sample: Record<string, string | number> = {};
  for (const [key, spec] of Object.entries(properties)) {
    sample[key] = spec.type === "number" || spec.type === "integer" ? 0 : "";
  }
  return JSON.stringify(sample, null, 2);
}

export interface RpcReply {
  body: unknown;
  sessionId: string | null;
}

async function readRpc(response: Response): Promise<RpcReply> {
  const sessionId = response.headers.get("mcp-session-id");
  if (response.status === 202 || response.status === 204) return { body: null, sessionId };
  const text = await response.text();
  if (!response.ok) throw new Error(text.slice(0, 280) || `MCP request failed (${response.status})`);
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/event-stream")) {
    const data = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .at(-1);
    return { body: data ? (JSON.parse(data) as unknown) : null, sessionId };
  }
  return { body: text ? (JSON.parse(text) as unknown) : null, sessionId };
}

export async function mcpRpc(options: {
  url: string;
  token?: string;
  sessionId?: string | null;
  message: Record<string, unknown>;
}): Promise<RpcReply> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": MCP_PROTOCOL,
  };
  if (options.sessionId) headers["mcp-session-id"] = options.sessionId;
  if (options.url.startsWith("/") && !options.url.startsWith("//")) {
    const response = await fetch(apiPath(options.url), {
      method: "POST",
      headers,
      body: JSON.stringify(options.message),
    });
    return readRpc(response);
  }
  const response = await fetch(apiPath("/api/mcp-proxy"), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      url: options.url,
      token: options.token || undefined,
      sessionId: options.sessionId || undefined,
      message: options.message,
    }),
  });
  const payload = (await response.json()) as { error?: string; status?: number; sessionId?: string | null; body?: unknown };
  if (!response.ok) throw new Error(payload.error || "Proxy failed");
  return { body: payload.body ?? null, sessionId: payload.sessionId ?? null };
}

function rpcData(body: unknown): unknown {
  const msg = body as Rpc | null;
  if (msg && typeof msg === "object" && msg.error) {
    throw new Error(msg.error.message || "MCP error");
  }
  return msg && typeof msg === "object" && "result" in msg ? msg.result : body;
}

let rpcId = 1;

export async function connectRemote(url: string, token: string): Promise<{ tools: McpTool[]; sessionId: string | null }> {
  let sessionId: string | null = null;
  const init = await mcpRpc({
    url,
    token,
    message: {
      jsonrpc: "2.0",
      id: rpcId++,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL,
        capabilities: {},
        clientInfo: { name: "vela", version: "1.0.0" },
      },
    },
  });
  sessionId = init.sessionId;
  rpcData(init.body);
  const note = await mcpRpc({
    url,
    token,
    sessionId,
    message: { jsonrpc: "2.0", method: "notifications/initialized" },
  });
  sessionId = note.sessionId ?? sessionId;
  const listed = await mcpRpc({
    url,
    token,
    sessionId,
    message: { jsonrpc: "2.0", id: rpcId++, method: "tools/list" },
  });
  sessionId = listed.sessionId ?? sessionId;
  const result = rpcData(listed.body) as { tools?: McpTool[] } | null;
  return { tools: result?.tools ?? [], sessionId };
}

export async function callRemote(
  url: string,
  token: string,
  sessionId: string | null,
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: McpToolResult; sessionId: string | null }> {
  const reply = await mcpRpc({
    url,
    token,
    sessionId,
    message: {
      jsonrpc: "2.0",
      id: rpcId++,
      method: "tools/call",
      params: { name, arguments: args },
    },
  });
  const result = rpcData(reply.body) as McpToolResult;
  if (!result || !Array.isArray(result.content)) throw new Error("Tool returned an empty result");
  return { result, sessionId: reply.sessionId ?? sessionId };
}
