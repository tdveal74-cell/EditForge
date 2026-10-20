import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 1_000_000;

function isBlockedAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (value.includes(":")) {
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isBlockedAddress(mapped[1]);
    return value === "::1" || value === "::" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd");
  }
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That is not a valid URL");
  }
  if (url.protocol !== "https:") throw new Error("Remote MCP servers must use https");
  if (url.username || url.password) throw new Error("Put the token in the token field, not the URL");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal") {
    throw new Error("That host is blocked");
  }
  if (isBlockedAddress(host)) throw new Error("That address is blocked");
  const dns = await import("node:dns/promises");
  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isBlockedAddress(record.address))) {
    throw new Error("That host does not resolve to a public address");
  }
  return url;
}

export const Route = createFileRoute("/api/mcp-proxy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { url?: unknown; token?: unknown; sessionId?: unknown; message?: unknown };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (typeof payload.url !== "string" || !payload.message || typeof payload.message !== "object") {
          return Response.json({ error: "url and message are required" }, { status: 400 });
        }
        try {
          const url = await assertPublicUrl(payload.url);
          const headers: Record<string, string> = {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": "2025-03-26",
          };
          if (typeof payload.token === "string" && payload.token.trim()) {
            headers.authorization = `Bearer ${payload.token.trim()}`;
          }
          if (typeof payload.sessionId === "string" && payload.sessionId.trim()) {
            headers["mcp-session-id"] = payload.sessionId.trim();
          }
          const upstream = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload.message),
            redirect: "manual",
            signal: AbortSignal.timeout(12000),
          });
          if (upstream.status >= 300 && upstream.status < 400) {
            return Response.json({ error: "Redirects are not followed" }, { status: 502 });
          }
          const sessionId = upstream.headers.get("mcp-session-id");
          if (upstream.status === 202 || upstream.status === 204) {
            return Response.json({ status: upstream.status, sessionId, body: null });
          }
          const text = await upstream.text();
          if (text.length > MAX_BYTES) return Response.json({ error: "Response is too large" }, { status: 502 });
          const type = upstream.headers.get("content-type") ?? "";
          let body: unknown = text;
          if (type.includes("text/event-stream")) {
            const data = text
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim())
              .filter(Boolean)
              .at(-1);
            body = data ? JSON.parse(data) : null;
          } else if (type.includes("json") || text.startsWith("{") || text.startsWith("[")) {
            try {
              body = JSON.parse(text);
            } catch {
              body = text;
            }
          }
          if (!upstream.ok) {
            const message = typeof body === "string" ? body : JSON.stringify(body);
            return Response.json({ error: message.slice(0, 400) || `Upstream ${upstream.status}` }, { status: 502 });
          }
          return Response.json({ status: upstream.status, sessionId, body });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Proxy failed";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
