// Google Gemini as Sprout's model (SPROUT_LLM_PROVIDER=gemini, the default). See ./index.mjs for the provider interface.
// Uses generateContentStream with function declarations; the calculators still run here on the server.

import { ApiError, GoogleGenAI } from "@google/genai";

// Free-tier stable Flash model as of 2026-10-26 (ai.google.dev/gemini-api/docs/pricing). Override with SPROUT_GEMINI_MODEL.
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

const THINKING = { low: "LOW", medium: "MEDIUM", high: "HIGH" };
// Finish reasons where Gemini declined to answer.
const BLOCKED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]);

/** Claude-style tool definitions (input_schema) as Gemini function declarations (JSON Schema parameters). */
export const toFunctionDeclarations = (tools) =>
  tools.map(({ name, description, input_schema }) => ({ name, description, parametersJsonSchema: input_schema }));

/** Seconds Gemini asks us to wait after a 429, from the RetryInfo detail in the error message (null when absent). */
export function retryAfterSeconds(err) {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(String(err?.message ?? ""));
  return m ? Math.ceil(Number(m[1])) : null;
}

/** Returns null without a key or client, which puts the app in preview mode. `client` is injectable for tests. */
export function createGeminiProvider({ apiKey, model = DEFAULT_GEMINI_MODEL, effort = "low", client = apiKey ? new GoogleGenAI({ apiKey }) : null } = {}) {
  if (!client) return null;
  let declarations = null;
  return {
    name: "gemini",
    model,

    start: (messages) => messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),

    async turn({ system, snapshot, tools, history, lastRound, signal, onText }) {
      declarations ??= toFunctionDeclarations(tools);
      const stream = await client.models.generateContentStream({
        model,
        contents: history,
        config: {
          systemInstruction: `${system}\n\n${snapshot}`,
          maxOutputTokens: 8000,
          tools: [{ functionDeclarations: declarations }],
          // After several calculator rounds, ask for a final answer.
          ...(lastRound ? { toolConfig: { functionCallingConfig: { mode: "NONE" } } } : {}),
          ...(THINKING[effort] ? { thinkingConfig: { thinkingLevel: THINKING[effort] } } : {}),
          abortSignal: signal,
        },
      });

      // Keep every part exactly as received: function-call parts carry thought signatures Gemini needs back next round.
      const parts = [];
      let finishReason;
      let blocked = false;
      let usage = {};
      for await (const chunk of stream) {
        if (chunk.promptFeedback?.blockReason) blocked = true;
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
        const candidate = chunk.candidates?.[0];
        if (candidate?.finishReason) finishReason = candidate.finishReason;
        for (const part of candidate?.content?.parts ?? []) {
          parts.push(part);
          if (part.text && !part.thought) onText(part.text);
        }
      }

      const cached = usage.cachedContentTokenCount ?? 0;
      return {
        stop:
          blocked || BLOCKED.has(finishReason)
            ? "refusal"
            : finishReason === "MAX_TOKENS"
              ? "max_tokens"
              : finishReason === "MALFORMED_FUNCTION_CALL"
                ? "failed"
                : "end",
        toolCalls: parts.filter((p) => p.functionCall).map(({ functionCall: fc }) => ({ id: fc.id, name: fc.name, input: fc.args ?? {} })),
        usage: {
          input: (usage.promptTokenCount ?? 0) - cached + (usage.toolUsePromptTokenCount ?? 0),
          output: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
          cacheRead: cached,
          cacheWrite: 0,
        },
        content: parts,
      };
    },

    // The model's turn unchanged, then one user turn with a functionResponse per call, in the same order.
    withToolResults: (history, turn, results) => [
      ...history,
      { role: "model", parts: turn.content },
      {
        role: "user",
        parts: results.map(({ call, output, error }) => ({
          functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response: error ? { error } : { output } },
        })),
      },
    ],

    classifyError(err) {
      if (err?.name === "AbortError") return "aborted";
      // 429 RESOURCE_EXHAUSTED: the free tier's per-minute or per-day quota is used up.
      if ((err instanceof ApiError && err.status === 429) || /RESOURCE_EXHAUSTED/.test(String(err?.message))) return "quota";
      if (err instanceof ApiError && err.status >= 500) return "busy";
      return "other";
    },

    describeError: (err) => (err instanceof ApiError ? `${err.status} ${err.message.slice(0, 300)}` : err),
    retryAfterSeconds,
  };
}
