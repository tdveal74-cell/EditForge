// Which model the Floor Agent talks to, and how. Claude is used when
// ANTHROPIC_API_KEY is set; Grok stays as the fallback so a studio that only
// holds an xAI key keeps working. Every provider failure becomes one of a
// fixed set of sentences: the provider's own error text never reaches the
// page, and the key never leaves this module.

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
export const AGENT_MAX_TOKENS = 6000;

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

function logProviderError(provider: AgentProvider, status: number, type: string | null) {
  // Status and error type only: never the key, never the provider's message.
  console.warn(
    JSON.stringify({
      event: "floor_agent_provider_error",
      provider: provider.id,
      model: provider.model,
      status,
      type,
    }),
  );
}

function anthropicFailure(status: number, type: string | null, message: string): string {
  if (status === 401) return `Claude rejected the studio's API key. ${NO_RENDER}`;
  if (status === 402 || type === "billing_error" || /credit balance/i.test(message))
    return `The Anthropic account is out of credit. Add credit in the Anthropic console, then try again. ${NO_RENDER}`;
  if (/usage limit/i.test(message))
    return `The Anthropic account has reached its spend limit. Raise it in the Anthropic console, then try again. ${NO_RENDER}`;
  if (status === 403) return `The Anthropic key is not allowed to use the Floor Agent's model. ${NO_RENDER}`;
  if (status === 404) return `The Floor Agent's Claude model was not found. ${NO_RENDER}`;
  if (status === 413) return `This project is too large to send to the agent. ${NO_RENDER}`;
  if (status === 429) return `Claude is rate limiting the studio. Wait a minute, then try again. ${NO_RENDER}`;
  if (status === 529 || type === "overloaded_error")
    return `Claude is overloaded right now. Try again shortly. ${NO_RENDER}`;
  return `Floor Agent provider returned HTTP ${status}. ${NO_RENDER}`;
}

async function callAnthropic(
  provider: AgentProvider,
  system: string,
  turns: ChatTurn[],
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": provider.key,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: AGENT_MAX_TOKENS,
      system,
      messages: turns,
      output_config: {
        format: { type: "json_schema", schema: FLOOR_REPLY_SCHEMA },
      },
    }),
    signal,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const err = (body?.error ?? null) as { type?: unknown; message?: unknown } | null;
    const type = typeof err?.type === "string" ? err.type : null;
    const message = typeof err?.message === "string" ? err.message : "";
    logProviderError(provider, response.status, type);
    throw new AgentProviderError(anthropicFailure(response.status, type, message));
  }
  if (body?.stop_reason === "max_tokens" || body?.stop_reason === "model_context_window_exceeded")
    throw new AgentProviderError(`The agent's answer was cut off before it finished. ${NO_RENDER}`);
  if (body?.stop_reason === "refusal")
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
      max_tokens: AGENT_MAX_TOKENS,
    }),
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    logProviderError(provider, response.status, null);
    throw new AgentProviderError(`Floor Agent provider returned HTTP ${response.status}. ${NO_RENDER}`);
  }
  const data = (await response.json().catch(() => null)) as {
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
 * it through parseAgentReply. Timeouts are rethrown as they are, so the route
 * can say the answer timed out.
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
      ? await callAnthropic(provider, `${system}\n\n${context}`, turns, signal)
      : await callXai(provider, system, context, turns, signal);
  } catch (err) {
    if (err instanceof AgentProviderError) throw err;
    if ((err as Error)?.name === "TimeoutError" || (err as Error)?.name === "AbortError") throw err;
    logProviderError(provider, 0, (err as Error)?.name ?? null);
    throw new AgentProviderError(`Could not reach the agent provider. ${NO_RENDER}`);
  }
}
