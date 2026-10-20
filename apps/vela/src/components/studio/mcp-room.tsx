import { useEffect, useState } from "react";
import { Btn, Kicker } from "@/components/studio/controls";
import {
  LOCAL_TOOLS,
  apiPath,
  callLocalTool,
  callRemote,
  connectRemote,
  sampleArgs,
  type McpTool,
  type McpToolResult,
} from "@/lib/studio/mcp";
import { useStudio } from "@/lib/studio/store";

interface SavedServer {
  id: string;
  name: string;
  url: string;
}

interface Conn {
  tools: McpTool[];
  sessionId: string | null;
}

const STORAGE_KEY = "vela-mcp-servers";

function loadServers(): SavedServer[] {
  const builtin: SavedServer = { id: "vela-endpoint", name: "Vela endpoint", url: "/api/mcp" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedServer[]) : [];
    const extra = Array.isArray(parsed)
      ? parsed.filter((item) => item && item.id !== builtin.id && typeof item.url === "string" && typeof item.name === "string")
      : [];
    return [builtin, ...extra];
  } catch {
    return [builtin];
  }
}

export function McpRoom() {
  const [servers, setServers] = useState<SavedServer[]>([{ id: "vela-endpoint", name: "Vela endpoint", url: "/api/mcp" }]);
  const [active, setActive] = useState("local");
  const [conns, setConns] = useState<Record<string, Conn>>({});
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [toolName, setToolName] = useState(LOCAL_TOOLS[0]?.name ?? "");
  const [argsText, setArgsText] = useState(sampleArgs(LOCAL_TOOLS[0]!));
  const [output, setOutput] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const flash = useStudio((state) => state.flash);
  const setScript = useStudio((state) => state.setScript);
  const addCard = useStudio((state) => state.addCard);
  const updateCard = useStudio((state) => state.updateCard);

  useEffect(() => {
    setServers(loadServers());
    setOrigin(window.location.origin);
  }, []);

  const tools = active === "local" ? LOCAL_TOOLS : (conns[active]?.tools ?? []);
  const selected = tools.find((tool) => tool.name === toolName) ?? tools[0];
  const endpoint = `${origin}${apiPath("/api/mcp")}`;

  function choose(id: string) {
    setActive(id);
    const nextTools = id === "local" ? LOCAL_TOOLS : (conns[id]?.tools ?? []);
    const first = nextTools[0];
    setToolName(first?.name ?? "");
    setArgsText(first ? sampleArgs(first) : "{}");
    setOutput("");
    setIsError(false);
  }

  function pickTool(tool: McpTool) {
    setToolName(tool.name);
    setArgsText(sampleArgs(tool));
  }

  function saveServers(next: SavedServer[]) {
    setServers(next);
    const stored = next.filter((item) => item.id !== "vela-endpoint");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  async function connect(server: SavedServer) {
    setBusy(true);
    setOutput("");
    try {
      const conn = await connectRemote(server.url, server.id === active ? token : "");
      setConns((current) => ({ ...current, [server.id]: conn }));
      setActive(server.id);
      const first = conn.tools[0];
      setToolName(first?.name ?? "");
      setArgsText(first ? sampleArgs(first) : "{}");
      setIsError(false);
      setOutput(conn.tools.length ? `${conn.tools.length} tools ready.` : "Connected. This server listed no tools.");
      flash(`Connected to ${server.name}.`);
    } catch (error) {
      setIsError(true);
      setOutput(error instanceof Error ? error.message : "Could not connect");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!selected) return;
    let args: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(argsText || "{}") as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Arguments must be a JSON object");
      args = parsed as Record<string, unknown>;
    } catch (error) {
      setIsError(true);
      setOutput(error instanceof Error ? error.message : "Invalid JSON");
      return;
    }
    setBusy(true);
    try {
      let result: McpToolResult;
      if (active === "local") result = callLocalTool(selected.name, args);
      else {
        const server = servers.find((item) => item.id === active);
        const conn = conns[active];
        if (!server || !conn) throw new Error("Connect this server first");
        const reply = await callRemote(server.url, token, conn.sessionId, selected.name, args);
        result = reply.result;
        setConns((current) => ({ ...current, [active]: { ...conn, sessionId: reply.sessionId } }));
      }
      setIsError(Boolean(result.isError));
      setOutput(result.content.map((part) => part.text).join("\n"));
    } catch (error) {
      setIsError(true);
      setOutput(error instanceof Error ? error.message : "Call failed");
    } finally {
      setBusy(false);
    }
  }

  function addServer() {
    const trimmed = url.trim();
    if (!trimmed.startsWith("https://")) {
      setIsError(true);
      setOutput("Remote servers need an https URL.");
      return;
    }
    const server = { id: crypto.randomUUID(), name: name.trim() || "MCP server", url: trimmed };
    saveServers([...servers, server]);
    setName("");
    setUrl("");
    void connect(server);
  }

  function applyScript() {
    if (!output || isError) return;
    const project = useStudio.getState();
    const current = project.projects.find((item) => item.id === project.activeId) ?? project.projects[0];
    if (!current) return;
    setScript(`${current.script.replace(/\s*$/, "")}\n\n${output.trim()}\n`);
    flash("Result appended to the script.");
  }

  function applyBoard() {
    if (!output || isError) return;
    addCard(1);
    const card = useStudio.getState().projects.find((item) => item.id === useStudio.getState().activeId)?.board.at(-1);
    if (card) updateCard(card.id, { title: selected?.name ?? "MCP", body: output.slice(0, 600) });
    flash("Result added to act I.");
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-3 md:p-6">
      <div>
        <h1 className="font-display text-4xl">MCP</h1>
        <p className="mt-2 max-w-2xl text-pretty text-mute">
          This project is a local MCP server for the open edit. The Vela endpoint is a streamable HTTP server other agents can call. Remote https servers connect through a guarded proxy.
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3">
        <Kicker>Endpoint</Kicker>
        <p className="truncate text-sm text-paper">{endpoint || "/api/mcp"}</p>
        <div className="flex flex-wrap gap-2">
          <Btn
            onClick={() => {
              void navigator.clipboard.writeText(endpoint);
              flash("Endpoint copied.");
            }}
          >
            Copy URL
          </Btn>
          <Btn
            onClick={() => {
              const snippet = JSON.stringify({ mcpServers: { vela: { url: endpoint } } }, null, 2);
              void navigator.clipboard.writeText(snippet);
              flash("Client config copied.");
            }}
          >
            Copy client config
          </Btn>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => choose("local")}
            className={`min-h-11 rounded-md border px-3 text-left text-sm ${active === "local" ? "border-copper bg-raise text-paper" : "border-line text-mute"}`}
          >
            This project
          </button>
          {servers.map((server) => (
            <div key={server.id} className="flex gap-1">
              <button
                type="button"
                onClick={() => choose(server.id)}
                className={`min-h-11 min-w-0 flex-1 rounded-md border px-3 text-left text-sm ${
                  active === server.id ? "border-copper bg-raise text-paper" : "border-line text-mute"
                }`}
              >
                <span className="block truncate">{server.name}</span>
                <span className="block truncate text-xs">{conns[server.id] ? "Connected" : "Not connected"}</span>
              </button>
              {server.id !== "vela-endpoint" && (
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-line px-3 text-xs text-mute"
                  onClick={() => saveServers(servers.filter((item) => item.id !== server.id))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <label className="flex flex-col gap-1 text-xs text-mute">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 rounded-md border border-line bg-ink px-3 text-sm text-paper outline-none focus:border-copper"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-mute">
            HTTPS URL
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/mcp"
              className="min-h-11 rounded-md border border-line bg-ink px-3 text-sm text-paper outline-none focus:border-copper"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-mute">
            Bearer token, optional
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              type="password"
              autoComplete="off"
              className="min-h-11 rounded-md border border-line bg-ink px-3 text-sm text-paper outline-none focus:border-copper"
            />
          </label>
          <Btn onClick={addServer}>Add server</Btn>
        </aside>

        <section className="flex min-w-0 flex-col gap-3">
          {active !== "local" && !conns[active] && (
            <Btn
              tone="copper"
              disabled={busy}
              onClick={() => {
                const server = servers.find((item) => item.id === active);
                if (server) void connect(server);
              }}
            >
              {busy ? "Connecting" : "Connect"}
            </Btn>
          )}
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <Btn key={tool.name} tone={tool.name === selected?.name ? "copper" : "ghost"} onClick={() => pickTool(tool)}>
                {tool.name}
              </Btn>
            ))}
          </div>
          {selected && <p className="text-sm text-pretty text-mute">{selected.description}</p>}
          <label className="flex flex-col gap-1 text-xs text-mute">
            Arguments
            <textarea
              value={argsText}
              onChange={(event) => setArgsText(event.target.value)}
              spellCheck={false}
              className="min-h-36 w-full resize-y rounded-md border border-line bg-ink p-3 font-sans text-sm text-paper outline-none focus:border-copper"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Btn tone="copper" disabled={busy || !selected} onClick={() => void run()}>
              {busy ? "Running" : "Run tool"}
            </Btn>
            <Btn disabled={!output || isError} onClick={applyScript}>
              Append to script
            </Btn>
            <Btn disabled={!output || isError} onClick={applyBoard}>
              Add to board
            </Btn>
          </div>
          {output && (
            <pre
              className={`max-h-80 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm ${
                isError ? "border-copper text-copper" : "border-line text-paper"
              }`}
            >
              {output}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}
