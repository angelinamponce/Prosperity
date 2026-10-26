// Claude as Sprout's model (SPROUT_LLM_PROVIDER=anthropic). See ./index.mjs for the provider interface.

import Anthropic from "@anthropic-ai/sdk";

/** Returns null without a key or client, which puts the app in preview mode. `client` is injectable for tests. */
export function createAnthropicProvider({ apiKey, model = "claude-sonnet-5-5", effort = "low", client = apiKey ? new Anthropic({ apiKey }) : null } = {}) {
  if (!client) return null;
  return {
    name: "anthropic",
    model,

    start: (messages) => messages.map((m) => ({ ...m })),

    async turn({ system, snapshot, tools, history, lastRound, signal, onText }) {
      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: 8000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort },
          system: [
            { type: "text", text: system, cache_control: { type: "ephemeral" } },
            { type: "text", text: snapshot },
          ],
          tools,
          // After several calculator rounds, ask for a final answer.
          ...(lastRound ? { tool_choice: { type: "none" } } : {}),
          messages: history,
        },
        { signal }
      );
      stream.on("text", onText);
      const message = await stream.finalMessage();
      const u = message.usage ?? {};
      return {
        stop: message.stop_reason === "refusal" ? "refusal" : message.stop_reason === "max_tokens" ? "max_tokens" : "end",
        toolCalls: message.content.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, input: b.input })),
        usage: {
          input: u.input_tokens ?? 0,
          output: u.output_tokens ?? 0,
          cacheRead: u.cache_read_input_tokens ?? 0,
          cacheWrite: u.cache_creation_input_tokens ?? 0,
        },
        content: message.content,
      };
    },

    // Append the whole assistant turn unchanged (thinking blocks included), then every result in one user turn.
    withToolResults: (history, turn, results) => [
      ...history,
      { role: "assistant", content: turn.content },
      {
        role: "user",
        content: results.map(({ call, output, error }) =>
          error
            ? { type: "tool_result", tool_use_id: call.id, is_error: true, content: error }
            : { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(output) }
        ),
      },
    ],

    classifyError(err) {
      if (err instanceof Anthropic.APIUserAbortError) return "aborted";
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) return "busy";
      return "other";
    },

    describeError: (err) => (err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err),
  };
}
