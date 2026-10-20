import { createFileRoute } from "@tanstack/react-router";
import { handleMcpMessage } from "@/lib/studio/mcp";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, mcp-session-id, mcp-protocol-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () =>
        json({
          name: "vela",
          protocol: "mcp",
          transport: "streamable-http",
          message: "POST JSON-RPC to this URL. Methods: initialize, tools/list, tools/call, ping.",
        }),
      POST: async ({ request }) => {
        let message: unknown;
        try {
          message = await request.json();
        } catch {
          return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
        }
        const result = handleMcpMessage(message);
        if (result === null) return new Response(null, { status: 202, headers: CORS });
        return json(result);
      },
    },
  },
});
