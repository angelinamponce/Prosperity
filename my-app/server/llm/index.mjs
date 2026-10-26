// Picks Sprout's model provider. SPROUT_LLM_PROVIDER = "gemini" (default, Google's free tier) or "anthropic".
//
// Every provider has the same shape, so chat.mjs runs one tool loop for both:
//   name, model
//   start(messages)          the cleaned [{ role: "user" | "assistant", content }] as the provider's own history
//   turn({ system, snapshot, tools, history, lastRound, signal, onText })
//     streams one model reply (text deltas go to onText) and resolves to
//     { stop: "end" | "max_tokens" | "refusal" | "failed", toolCalls: [{ id, name, input }], usage: { input, output, cacheRead, cacheWrite }, content }
//     lastRound asks for a final answer with no more tool calls.
//   withToolResults(history, turn, results)   history plus that reply and its results ([{ call, output } | { call, error }])
//   classifyError(err)        "aborted" | "quota" | "busy" | "other"
//   describeError(err)        a short line for the log (never the key)

import { createAnthropicProvider } from "./anthropic.mjs";
import { DEFAULT_GEMINI_MODEL, createGeminiProvider } from "./gemini.mjs";

export const PROVIDERS = ["gemini", "anthropic"];

/** Returns null when the chosen provider has no API key (the app then uses scripted preview replies). */
export function createLlm({ env = process.env } = {}) {
  const provider = (env.SPROUT_LLM_PROVIDER || "gemini").trim().toLowerCase();
  const effort = env.SPROUT_EFFORT || "low";
  if (provider === "gemini") {
    return createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.SPROUT_GEMINI_MODEL || DEFAULT_GEMINI_MODEL, effort });
  }
  if (provider === "anthropic") {
    return createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.SPROUT_MODEL || "claude-sonnet-5-5", effort });
  }
  throw new Error(`SPROUT_LLM_PROVIDER must be one of ${PROVIDERS.join(", ")} (got "${provider}")`);
}

/** The environment variable holding the chosen provider's key, for startup messages. */
export const keyName = (env = process.env) => ((env.SPROUT_LLM_PROVIDER || "gemini").trim().toLowerCase() === "anthropic" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY");
