import { NextResponse } from "next/server";
import { PROTOCOL_VERSION, SERVER_INFO, findTool, toolsFor } from "@/lib/mcp";

export const dynamic = "force-dynamic";

/**
 * MCP over streamable HTTP, stateless.
 *
 * Stateless is the right shape here: on serverless there is no instance
 * affinity between requests, so a session held in memory would be a session
 * that vanishes. Every POST carries everything needed to answer it.
 *
 * Authentication gates *writes*, not reads. Without `EDITFORGE_MCP_TOKEN` set,
 * or without a matching bearer token, the mutating tools are not listed and not
 * callable — a public endpoint that could spend a user's provider budget is not
 * something to ship and hope nobody finds.
 */

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const ok = (id: unknown, result: unknown) => NextResponse.json({ jsonrpc: "2.0", id, result });

const fail = (id: unknown, code: number, message: string) =>
  NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });

/**
 * Constant-time compare so a wrong token cannot be discovered a character at a
 * time by timing the response.
 */
function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function isAuthenticated(req: Request): boolean {
  const expected = process.env.EDITFORGE_MCP_TOKEN;
  // No token configured means no write access for anyone, including us.
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return false;
  return tokenMatches(provided, expected);
}

export async function POST(req: Request) {
  let body: RpcRequest;
  try {
    body = await req.json();
  } catch {
    return fail(null, -32700, "Parse error");
  }

  const { id, method, params } = body ?? {};
  const authed = isAuthenticated(req);

  // Notifications carry no id and expect no response body.
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "EditForge is a post-production studio OS built on premium restraint: the grade protects the image rather than restaging it, and a master export is blocked until the restraint rubric passes. Call editforge_status first to see which durable store is active and whether any provider could bill real work. Prefer provider 'mock' unless the user explicitly asked for a real render.",
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return new NextResponse(null, { status: 202 });

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, {
        tools: toolsFor(authed).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const name = String(params?.name ?? "");
      const args = (params?.arguments ?? {}) as Record<string, unknown>;
      const tool = findTool(name, authed);

      if (!tool) {
        // Say plainly when the tool exists but the caller may not use it,
        // rather than pretending it does not exist and inviting a retry loop.
        const gated = findTool(name, true);
        const message = gated
          ? `Tool "${name}" changes state and requires authentication. Set EDITFORGE_MCP_TOKEN on the server and send it as a bearer token.`
          : `Unknown tool "${name}"`;
        return ok(id, { content: [{ type: "text", text: message }], isError: true });
      }

      try {
        const result = await tool.run(args as never);
        return ok(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (err) {
        // A tool throwing is a tool result, not a transport failure — the model
        // should see the reason and be able to act on it.
        return ok(id, {
          content: [{ type: "text", text: `${name} failed: ${(err as Error).message}` }],
          isError: true,
        });
      }
    }

    default:
      if (isNotification) return new NextResponse(null, { status: 202 });
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

/**
 * The spec allows a GET for a server-initiated SSE stream. This server never
 * initiates, so it declines rather than holding a stream open that will only
 * ever be silent.
 */
export async function GET() {
  return NextResponse.json(
    { error: "This MCP server is stateless and does not offer a server-initiated stream. POST JSON-RPC instead." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
