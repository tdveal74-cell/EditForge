import { NextResponse } from "next/server";
import { SERVER_INFO, findTool, negotiateVersion, toolsFor } from "@/lib/mcp";
import { URL_TOKEN_PARAM } from "@/lib/auth";

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
  const fromHeader = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (fromHeader && tokenMatches(fromHeader, expected)) return true;

  // Some MCP clients only accept a URL — there is no field for a header. The
  // same token is accepted as `?key=`, which is weaker (URLs land in logs,
  // headers usually do not) but is the difference between usable and not.
  const fromUrl = new URL(req.url).searchParams.get(URL_TOKEN_PARAM) ?? "";
  return Boolean(fromUrl) && tokenMatches(fromUrl, expected);
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
        // Answer in the client's revision when we can speak it, so a client
        // pinned to an older one is not handed a newer version it may refuse.
        protocolVersion: negotiateVersion(params?.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "EditForge is a post-production control plane built on premium restraint: the grade protects the image rather than restaging it, and a master export is blocked until the restraint rubric passes. Call editforge_status first to see which durable store is active and whether any provider could bill real work. Prefer provider 'mock' unless the user explicitly asked for a real render.",
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
        // Not every gated tool is a write — some are reads over private data —
        // so say which it is rather than telling a caller its lookup "changes
        // state" when it does not.
        const reason = gated?.mutating ? "changes state" : "reads private data";
        const message = gated
          ? `Tool "${name}" ${reason} and requires authentication. Set EDITFORGE_MCP_TOKEN on the server and send it as a bearer token.`
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
