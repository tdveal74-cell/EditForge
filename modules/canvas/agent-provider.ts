// Which model the Floor Agent talks to, and how. Claude is used when
// ANTHROPIC_API_KEY is set; Grok stays as the fallback so a studio that only
// holds an xAI key keeps working. Every provider failure becomes one of a
// fixed set of sentences: the provider's own error text never reaches the
// page, and the key never reaches the page, a response or the log.
//
// Plain fetch, no SDK, so there is no automatic retry: an overload or a rate
// limit reaches the producer as its own sentence and a resend is one tap.
// That keeps each turn inside the route's single 100 second budget.

export type AgentProviderId = "anthropic" | "xai";
export type AgentProvider = {
  id: AgentProviderId;
  label: "Claude" | "Grok";
  model: string;
  key: string;
};
export type ChatTurn = { role: "user" | "assistant"; content: string };

export const DEFAULT_ANTHROPIC_AGENT_MODEL = "claude-sonnet-5";
export const DEFAULT_XAI_AGENT_MODEL = "grok-4.6";
export const ANTHROPIC_VERSION = "2023-06-01";
export const AGENT_MAX_TOKENS = 8000;

export function agentProvider(
  env: Record<string, string | undefined> = process.env,
): AgentProvider | null {
  const anthropic = env.ANTHROPIC_API_KEY?.trim();
  if (anthropic)
    return {
      id: "anthropic",
      label: "Claude",
      model: env.ANTHROPIC_AGENT_MODEL?.trim() || DEFAULT_ANTHROPIC_AGENT_MODEL,
      key: anthropic,
    };
  const xai = env.XAI_API_KEY?.trim();
  if (xai)
    return {
      id: "xai",
      label: "Grok",
      model: env.XAI_AGENT_MODEL?.trim() || DEFAULT_XAI_AGENT_MODEL,
      key: xai,
    };
  return null;
}

/** A failure whose message is safe to show on the page as it stands. */
export class AgentProviderError extends Error {
  name = "AgentProviderError";
}

const NO_RENDER = "No render was submitted.";

// The reply shape FLOOR_SYSTEM describes, as a JSON schema Claude's structured
// outputs are held to, so the answer always parses. Structured outputs need
// additionalProperties: false on every object; a property left out of
// "required" is optional. parseAgentReply still validates everything, because
// a schema cannot know which node ids exist in this project.
export const FLOOR_REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    action: { type: "string", enum: ["reply", "plan", "render", "outputs"] },
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: {
            type: "string",
            enum: ["prompt", "style", "image", "video", "voice", "output"],
          },
          title: { type: "string" },
          prompt: { type: "string" },
          aspectRatio: { type: "string" },
          duration: { type: "number" },
          voiceId: { type: "string" },
        },
        required: ["id", "kind", "title", "prompt"],
        additionalProperties: false,
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: { from: { type: "string" }, to: { type: "string" } },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
    nodeIds: { type: "array", items: { type: "string" } },
  },
  required: ["reply", "action"],
  additionalProperties: false,
} as const;

function isAbort(err: unknown): boolean {
  const name = (err as Error | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

// Reading the body can fail after the headers arrived. A timeout there is
// still a timeout and is rethrown as one; anything else reads as no body.
async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch (err) {
    if (isAbort(err)) throw err;
    return null;
  }
}

function log(
  provider: AgentProvider,
  event: "floor_agent_provider_error" | "floor_agent_turn",
  fields: Record<string, unknown>,
) {
  // Status, type, stop reason and token counts only. Never the key; a provider
  // message only when one is passed in, already stripped of the key.
  const line = JSON.stringify({ event, provider: provider.id, model: provider.model, ...fields });
  if (event === "floor_agent_turn") console.info(line);
  else console.warn(line);
}

function anthropicFailure(status: number, type: string | null, message: string): string {
  if (status === 401) return `Claude rejected the studio's API key. ${NO_RENDER}`;
  if (status === 402 || type === "billing_error" || /credit balance/i.test(message))
    return `The Anthropic account is out of credit. Add credit in the Anthropic console, then try again. ${NO_RENDER}`;
  if (/usage limit/i.test(message))
    return `The Anthropic account has reached its spend limit. Raise it in the Anthropic console, then try again. ${NO_RENDER}`;
  if (/anthropic-workspace-id/i.test(message))
    return `The Anthropic key is not tied to one workspace. Create a key scoped to a workspace in the Anthropic console and install it instead. ${NO_RENDER}`;
  if (status === 403)
    return `The Anthropic key is not permitted to make this request. Check the key's organization and workspace access. ${NO_RENDER}`;
  if (status === 404)
    return `The Claude model set in ANTHROPIC_AGENT_MODEL was not found. ${NO_RENDER}`;
  if (status === 413)
    return `This request, the project plus the recent conversation, is too large to send to the agent. ${NO_RENDER}`;
  if (status === 429) return `Claude is rate limiting the studio. Wait a minute, then try again. ${NO_RENDER}`;
  if (status === 529 || type === "overloaded_error")
    return `Claude is overloaded right now. Try again shortly. ${NO_RENDER}`;
  return `Floor Agent provider returned HTTP ${status}. ${NO_RENDER}`;
}

async function callAnthropic(
  provider: AgentProvider,
  system: string,
  context: string,
  turns: ChatTurn[],
  signal: AbortSignal,
): Promise<unknown> {
  // The project data rides in the newest user turn, marked as data, so the
  // system prompt carries the studio's instructions and nothing else.
  const last = turns[turns.length - 1];
  const messages: ChatTurn[] = [
    ...turns.slice(0, -1),
    {
      role: "user",
      content: `<project_data>\n${context}\n</project_data>\n\n${last?.content ?? ""}`,
    },
  ];
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: AGENT_MAX_TOKENS,
      // Thinking off, chosen rather than inherited: some models think by
      // default, and thinking shares max_tokens with the answer, so a long
      // plan could be cut off or run past the route's time limit.
      thinking: { type: "disabled" },
      system,
      messages,
      output_config: {
        format: { type: "json_schema", schema: FLOOR_REPLY_SCHEMA },
      },
    }),
    signal,
    cache: "no-store",
  });
  const body = await readJson(response);
  if (!response.ok) {
    const err = (body?.error ?? null) as { type?: unknown; message?: unknown } | null;
    const type = typeof err?.type === "string" ? err.type : null;
    const message = typeof err?.message === "string" ? err.message : "";
    // A 400 is the one failure whose cause only the provider's text names, so
    // the operator log carries that text, key removed; the page never does.
    const detail =
      response.status === 400 ? message.split(provider.key).join("[key]").slice(0, 200) : undefined;
    log(provider, "floor_agent_provider_error", { status: response.status, type, detail });
    throw new AgentProviderError(anthropicFailure(response.status, type, message));
  }
  const usage = (body?.usage ?? {}) as { input_tokens?: unknown; output_tokens?: unknown };
  const stop = typeof body?.stop_reason === "string" ? body.stop_reason : null;
  log(provider, "floor_agent_turn", {
    stop_reason: stop,
    input_tokens: typeof usage.input_tokens === "number" ? usage.input_tokens : null,
    output_tokens: typeof usage.output_tokens === "number" ? usage.output_tokens : null,
  });
  if (stop === "max_tokens" || stop === "model_context_window_exceeded")
    throw new AgentProviderError(`The agent's answer was cut off before it finished. ${NO_RENDER}`);
  if (stop === "refusal")
    throw new AgentProviderError(`Claude declined to answer that message. ${NO_RENDER}`);
  const content = Array.isArray(body?.content) ? (body.content as Record<string, unknown>[]) : [];
  const text = content
    .filter((c) => c?.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("");
  if (!text.trim()) throw new AgentProviderError(`The agent returned no message. ${NO_RENDER}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new AgentProviderError(`The agent did not return a valid response. ${NO_RENDER}`);
  }
}

async function callXai(
  provider: AgentProvider,
  system: string,
  context: string,
  turns: ChatTurn[],
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: system },
        { role: "system", content: context },
        ...turns,
      ],
      response_format: { type: "json_object" },
      max_tokens: 6000,
    }),
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    log(provider, "floor_agent_provider_error", { status: response.status, type: null });
    throw new AgentProviderError(`Floor Agent provider returned HTTP ${response.status}. ${NO_RENDER}`);
  }
  const data = (await readJson(response)) as {
    choices?: { message?: { content?: unknown } }[];
  } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string")
    throw new AgentProviderError(`The agent returned no message. ${NO_RENDER}`);
  try {
    return JSON.parse(content);
  } catch {
    throw new AgentProviderError(`The agent did not return a valid response. ${NO_RENDER}`);
  }
}

/**
 * One agent turn. `system` is the standing instruction and `context` the
 * project data, kept apart so each provider can place them its own way.
 * Resolves to the provider's JSON object, not yet validated: the caller runs
 * it through parseAgentReply. A timeout, whether it fires before the reply
 * starts or while it is being read, is rethrown as it is, so the route can say
 * the answer timed out.
 */
export async function callAgentModel(
  provider: AgentProvider,
  system: string,
  context: string,
  turns: ChatTurn[],
  signal: AbortSignal,
): Promise<unknown> {
  try {
    return provider.id === "anthropic"
      ? await callAnthropic(provider, system, context, turns, signal)
      : await callXai(provider, system, context, turns, signal);
  } catch (err) {
    if (err instanceof AgentProviderError) throw err;
    if (isAbort(err)) throw err;
    // The error's name only: a malformed key can appear in a fetch error message.
    log(provider, "floor_agent_provider_error", { status: 0, type: (err as Error)?.name ?? null });
    throw new AgentProviderError(`Could not reach the agent provider. ${NO_RENDER}`);
  }
}
