import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_MAX_TOKENS,
  ANTHROPIC_VERSION,
  AgentProviderError,
  DEFAULT_ANTHROPIC_AGENT_MODEL,
  FLOOR_REPLY_SCHEMA,
  agentProvider,
  callAgentModel,
  type AgentProvider,
} from "./agent-provider";

const KEY = "sk-ant-test-key-never-shown";
const claude: AgentProvider = { id: "anthropic", label: "Claude", model: "claude-sonnet-5", key: KEY };
const grok: AgentProvider = { id: "xai", label: "Grok", model: "grok-4.6", key: "xai-test-key-never-shown" };
const turns = [
  { role: "user" as const, content: "Plan a scene." },
  { role: "assistant" as const, content: '{"reply":"ok","action":"reply"}' },
  { role: "user" as const, content: "Now a held ending." },
];

let fetchMock: ReturnType<typeof vi.fn>;
function answer(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}
function claudeText(text: string, stop_reason = "end_turn") {
  answer(200, { type: "message", role: "assistant", content: [{ type: "text", text }], stop_reason });
}
const call = (p: AgentProvider = claude) =>
  callAgentModel(p, "SYSTEM RULES", "PROJECT CONTEXT", turns, new AbortController().signal);
async function failure(p: AgentProvider = claude): Promise<Error> {
  try {
    await call(p);
  } catch (e) {
    return e as Error;
  }
  throw new Error("expected the provider call to fail");
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("agentProvider", () => {
  it("is null with no key, and ignores keys that are only whitespace", () => {
    expect(agentProvider({})).toBeNull();
    expect(agentProvider({ ANTHROPIC_API_KEY: "  ", XAI_API_KEY: "\t" })).toBeNull();
  });
  it("chooses Claude when its key is set, even beside an xAI key", () => {
    const p = agentProvider({ ANTHROPIC_API_KEY: " k ", XAI_API_KEY: "x" });
    expect(p).toEqual({ id: "anthropic", label: "Claude", model: DEFAULT_ANTHROPIC_AGENT_MODEL, key: "k" });
  });
  it("keeps Grok as the fallback when only an xAI key is set", () => {
    expect(agentProvider({ XAI_API_KEY: "x" })).toMatchObject({ id: "xai", label: "Grok", model: "grok-4.6" });
  });
  it("takes the model from the environment when one is named", () => {
    expect(agentProvider({ ANTHROPIC_API_KEY: "k", ANTHROPIC_AGENT_MODEL: " claude-opus-5-5 " })?.model).toBe("claude-opus-5-5");
    expect(agentProvider({ ANTHROPIC_API_KEY: "k", ANTHROPIC_AGENT_MODEL: " " })?.model).toBe(DEFAULT_ANTHROPIC_AGENT_MODEL);
  });
});

describe("FLOOR_REPLY_SCHEMA", () => {
  it("meets the structured outputs rules: every object closed, every required key declared", () => {
    const objects: Record<string, unknown>[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (o.type === "object") objects.push(o);
      Object.values(o).forEach(walk);
    };
    walk(FLOOR_REPLY_SCHEMA);
    expect(objects.length).toBe(3);
    for (const o of objects) {
      expect(o.additionalProperties).toBe(false);
      const props = Object.keys(o.properties as object);
      for (const r of o.required as string[]) expect(props).toContain(r);
    }
  });
  it("has no keyword structured outputs rejects", () => {
    const text = JSON.stringify(FLOOR_REPLY_SCHEMA);
    for (const k of ["minimum", "maximum", "minLength", "maxLength", "maxItems", "multipleOf"])
      expect(text).not.toContain(`"${k}"`);
  });
});

describe("callAgentModel with Claude", () => {
  it("sends the Messages API request the docs describe, with the schema as structured output", async () => {
    claudeText('{"reply":"Two scenes.","action":"reply"}');
    await expect(call()).resolves.toEqual({ reply: "Two scenes.", action: "reply" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    });
    expect(ANTHROPIC_VERSION).toBe("2023-06-01");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.max_tokens).toBe(AGENT_MAX_TOKENS);
    expect(body.system).toBe("SYSTEM RULES\n\nPROJECT CONTEXT");
    expect(body.messages).toEqual(turns);
    expect(body.output_config).toEqual({ format: { type: "json_schema", schema: FLOOR_REPLY_SCHEMA } });
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("tool_choice");
  });

  it("joins the text blocks before parsing", async () => {
    answer(200, {
      content: [
        { type: "text", text: '{"reply":"a' },
        { type: "text", text: 'b","action":"reply"}' },
      ],
      stop_reason: "end_turn",
    });
    await expect(call()).resolves.toEqual({ reply: "ab", action: "reply" });
  });

  const failures: [string, number, unknown, RegExp][] = [
    ["a rejected key", 401, { type: "error", error: { type: "authentication_error", message: "API key is invalid." } }, /rejected the studio's API key/],
    ["a billing error", 402, { type: "error", error: { type: "billing_error", message: "PROVIDER TEXT 402" } }, /out of credit/],
    ["the old credit message", 400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }, /out of credit/],
    ["a spend limit", 400, { type: "error", error: { type: "invalid_request_error", message: "You have reached your specified API usage limits." } }, /spend limit/],
    ["a forbidden model", 403, { type: "error", error: { type: "permission_error", message: "PROVIDER TEXT 403" } }, /not allowed to use/],
    ["an unknown model", 404, { type: "error", error: { type: "not_found_error", message: "PROVIDER TEXT 404" } }, /model was not found/],
    ["a request too large", 413, { type: "error", error: { type: "request_too_large", message: "PROVIDER TEXT 413" } }, /too large/],
    ["a rate limit", 429, { type: "error", error: { type: "rate_limit_error", message: "PROVIDER TEXT 429" } }, /rate limiting/],
    ["an overload", 529, { type: "error", error: { type: "overloaded_error", message: "PROVIDER TEXT 529" } }, /overloaded/],
    ["an unlisted server error", 500, { type: "error", error: { type: "api_error", message: "PROVIDER TEXT 500" } }, /returned HTTP 500/],
    ["a body that is not JSON", 502, "<html>bad gateway</html>", /returned HTTP 502/],
  ];
  for (const [name, status, body, expected] of failures) {
    it(`turns ${name} into a fixed sentence that names no key and no provider text`, async () => {
      answer(status, body);
      const err = await failure();
      expect(err).toBeInstanceOf(AgentProviderError);
      expect(err.message).toMatch(expected);
      expect(err.message).toMatch(/No render was submitted\.$/);
      expect(err.message).not.toContain(KEY);
      const provided = (body as { error?: { message?: string } })?.error?.message;
      if (provided) expect(err.message).not.toContain(provided);
      if (typeof body === "string") expect(err.message).not.toContain(body);
      const logged = vi.mocked(console.warn).mock.calls.map((c) => String(c[0])).join("\n");
      expect(logged).toContain('"event":"floor_agent_provider_error"');
      expect(logged).toContain(`"status":${status}`);
      expect(logged).not.toContain(KEY);
      if (provided) expect(logged).not.toContain(provided);
    });
  }

  it("refuses an answer cut off at the token limit rather than parsing half of it", async () => {
    claudeText('{"reply":"half', "max_tokens");
    await expect(call()).rejects.toThrow(/cut off/);
  });
  it("says so when Claude declines", async () => {
    claudeText("", "refusal");
    await expect(call()).rejects.toThrow(/declined/);
  });
  it("reports an empty answer and an unparseable one", async () => {
    answer(200, { content: [], stop_reason: "end_turn" });
    await expect(call()).rejects.toThrow(/returned no message/);
    claudeText("not json at all");
    await expect(call()).rejects.toThrow(/did not return a valid response/);
  });
  it("says the provider could not be reached when the network fails", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }));
    const err = await failure();
    expect(err).toBeInstanceOf(AgentProviderError);
    expect(err.message).toMatch(/Could not reach the agent provider/);
  });
  it("lets a timeout through untouched, so the route can say the answer timed out", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    const err = await failure();
    expect(err.name).toBe("TimeoutError");
  });
});

describe("callAgentModel with Grok", () => {
  it("keeps the xAI request exactly as it was", async () => {
    answer(200, { choices: [{ message: { content: '{"reply":"hi","action":"reply"}' } }] });
    await expect(call(grok)).resolves.toEqual({ reply: "hi", action: "reply" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
    expect(init.headers.Authorization).toBe(`Bearer ${grok.key}`);
    const body = JSON.parse(init.body);
    expect(body.model).toBe("grok-4.6");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages.slice(0, 2)).toEqual([
      { role: "system", content: "SYSTEM RULES" },
      { role: "system", content: "PROJECT CONTEXT" },
    ]);
    expect(body.messages.slice(2)).toEqual(turns);
  });
  it("names the HTTP status on failure and never the key", async () => {
    answer(403, { error: "nope" });
    const err = await failure(grok);
    expect(err.message).toMatch(/returned HTTP 403/);
    expect(err.message).not.toContain(grok.key);
  });
  it("refuses content that is not JSON", async () => {
    answer(200, { choices: [{ message: { content: "plain words" } }] });
    await expect(call(grok)).rejects.toThrow(/did not return a valid response/);
  });
});
