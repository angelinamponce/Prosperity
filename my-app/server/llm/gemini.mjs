// Google Gemini as Sprout's model (SPROUT_LLM_PROVIDER=gemini, the default). See ./index.mjs for the provider interface.
// Uses generateContentStream with function declarations; the calculators still run here on the server.
//
// Models are tried in order (SPROUT_GEMINI_MODELS). When one is overloaded (503 UNAVAILABLE) before it has sent
// anything, it gets one more try after a short pause, then the next model takes over. A reply stays on the model that
// answered its first round, because thought signatures from one model aren't valid on another. A 429 (quota; free-tier
// quotas are per model) also moves on to the next model, and the exhausted model is skipped by later requests until
// Google's retry delay passes (60s if it gives none), or until midnight Pacific for a per-day quota. Preview mode only
// happens when every model is exhausted or failing. Overloaded requests can take minutes to fail, so each round gives
// up on models that haven't started streaming after FIRST_OUTPUT_MS in total.

import { ApiError, GoogleGenAI } from "@google/genai";

// Free-tier models as of 2026-10-26 (ai.google.dev/gemini-api/docs/pricing): Flash-Lite (higher free limits), then Flash.
export const DEFAULT_GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
export const FIRST_OUTPUT_MS = 20_000; // per round: from the first request to the first streamed chunk, across all tries
export const RETRY_BACKOFF_MS = 1_000;
export const QUOTA_SKIP_SECONDS = 60; // after a 429 that gives no retry delay

const THINKING = { low: "LOW", medium: "MEDIUM", high: "HIGH" };
// Finish reasons where Gemini declined to answer.
const BLOCKED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]);

/** Every model was overloaded, or none started answering within FIRST_OUTPUT_MS. */
export class GeminiUnavailableError extends Error {
  constructor(tried, cause) {
    super(`Gemini unavailable (tried ${tried.join(", ")})`, { cause });
    this.tried = tried;
  }
}

/** Every model in the chain has used up its quota. `retryAfter` = seconds until the first one is usable again. */
export class GeminiExhaustedError extends Error {
  constructor(models, retryAfter, cause) {
    super(`Gemini quota used up on every model (${models.join(", ")})`, { cause });
    this.retryAfter = retryAfter;
  }
}

/** Claude-style tool definitions (input_schema) as Gemini function declarations (JSON Schema parameters). */
export const toFunctionDeclarations = (tools) =>
  tools.map(({ name, description, input_schema }) => ({ name, description, parametersJsonSchema: input_schema }));

/** "a, b,,c" → ["a", "b", "c"]; empty → the defaults. */
export const parseModels = (value) => {
  const list = String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : [...DEFAULT_GEMINI_MODELS];
};

/** Seconds Gemini asks us to wait after a 429, from the RetryInfo detail in the error message (null when absent). */
export function retryAfterSeconds(err) {
  if (err instanceof GeminiExhaustedError) return err.retryAfter;
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(String(err?.message ?? ""));
  return m ? Math.ceil(Number(m[1])) : null;
}

/** A per-day quota (for example quotaId "GenerateRequestsPerDayPerProjectPerModel-FreeTier"), not a per-minute one. */
export const isDailyQuota = (err) => /PerDay|per[ _-]day|daily/i.test(String(err?.message ?? ""));

/** The next midnight in America/Los_Angeles (when Gemini's daily quotas reset), as epoch ms. */
export function nextPacificMidnight(nowMs) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hourCycle: "h23", hour: "numeric", minute: "numeric", second: "numeric" })
      .formatToParts(new Date(nowMs))
      .map((p) => [p.type, Number(p.value)])
  );
  const sinceMidnight = ((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000 + (nowMs % 1000);
  return nowMs - sinceMidnight + 24 * 3600 * 1000;
}

const isQuota = (err) => (err instanceof ApiError && err.status === 429) || /RESOURCE_EXHAUSTED/.test(String(err?.message));
const isOverloaded = (err) => (err instanceof ApiError && err.status === 503) || /\bUNAVAILABLE\b/.test(String(err?.message));

/** The SDK client, with its own retries pinned off so retrying stays here (it only retries when retryOptions is set). */
export const createGeminiClient = (apiKey, fetch) =>
  new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 }, ...(fetch ? { fetch } : {}) } });

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/** Returns null without a key or client, which puts the app in preview mode. `client` is injectable for tests. */
export function createGeminiProvider({
  apiKey,
  models = DEFAULT_GEMINI_MODELS,
  effort = "low",
  firstOutputMs = FIRST_OUTPUT_MS,
  backoffMs = RETRY_BACKOFF_MS,
  client = apiKey ? createGeminiClient(apiKey) : null,
  now = () => Date.now(),
  log = console,
} = {}) {
  if (!client) return null;
  let declarations = null;
  // model → epoch ms until which it's skipped, after a 429. Shared by every visitor (one key, one quota).
  const exhaustedUntil = new Map();
  const isExhausted = (model) => (exhaustedUntil.get(model) ?? 0) > now();

  function markExhausted(model, err) {
    const daily = isDailyQuota(err);
    const until = daily ? nextPacificMidnight(now()) : now() + (retryAfterSeconds(err) ?? QUOTA_SKIP_SECONDS) * 1000;
    exhaustedUntil.set(model, until);
    log.warn?.(
      `[sprout] gemini 429 from ${model} (${daily ? "daily quota" : "rate limit"}); skipping it for ${Math.ceil((until - now()) / 1000)}s`
    );
  }

  /** One streamed request. Throws with `started` set once any chunk has arrived (too late to switch models). */
  async function streamOnce(model, { system, snapshot, tools, contents, lastRound, signal, onText, deadline }) {
    declarations ??= toFunctionDeclarations(tools);
    // Until the first chunk arrives, give up at the deadline; after that only the user's Stop ends the stream.
    const firstChunk = new AbortController();
    const timer = setTimeout(() => firstChunk.abort(), Math.max(0, deadline - Date.now()));
    let started = false;
    try {
      const stream = await client.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: `${system}\n\n${snapshot}`,
          maxOutputTokens: 8000,
          tools: [{ functionDeclarations: declarations }],
          // After several calculator rounds, ask for a final answer.
          ...(lastRound ? { toolConfig: { functionCallingConfig: { mode: "NONE" } } } : {}),
          ...(THINKING[effort] ? { thinkingConfig: { thinkingLevel: THINKING[effort] } } : {}),
          abortSignal: signal ? AbortSignal.any([signal, firstChunk.signal]) : firstChunk.signal,
        },
      });

      // Keep every part exactly as received: function-call parts carry thought signatures Gemini needs back next round.
      const parts = [];
      let finishReason;
      let blocked = false;
      let usage = {};
      for await (const chunk of stream) {
        if (!started) {
          started = true;
          clearTimeout(timer);
        }
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
        model,
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
    } catch (err) {
      // The deadline (not the user) cut a request that hadn't started: count it like an overloaded model.
      if (!started && firstChunk.signal.aborted && !signal?.aborted) throw Object.assign(new Error("No answer before the deadline"), { overloaded: true });
      if (started && err && typeof err === "object") err.started = true;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: "gemini",
    model: models.join(" → "),
    models,

    // `model` is set by the round that answers first; later rounds of the same reply stay on it.
    start: (messages) => ({
      model: null,
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    }),

    async turn({ history, signal, ...rest }) {
      // A reply's later rounds can't switch models; its first round tries every model that isn't exhausted.
      const candidates = history.model ? [history.model] : models.filter((m) => !isExhausted(m));
      const deadline = Date.now() + firstOutputMs;
      let lastErr;
      for (const [i, model] of candidates.entries()) {
        // Each model gets an even share of the time left, so one that hangs can't use up the next one's chance.
        const modelDeadline = Date.now() + Math.max(0, deadline - Date.now()) / (candidates.length - i);
        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (attempt) await sleep(Math.min(backoffMs, Math.max(0, modelDeadline - Date.now())), signal);
          if (signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
          if (Date.now() >= modelDeadline) break;
          try {
            return await streamOnce(model, { ...rest, contents: history.contents, signal, deadline: modelDeadline });
          } catch (err) {
            // Too late to switch models (text already streamed, or a later round of the reply): a 429 is reported as busy.
            const midReply = () => Object.assign(new Error("Gemini quota used up mid-reply", { cause: err }), { overloaded: true, started: true });
            if (isQuota(err)) markExhausted(model, err);
            if (err?.started || signal?.aborted) throw isQuota(err) ? midReply() : err;
            if (isQuota(err)) {
              if (history.model) throw midReply();
              lastErr = err;
              break; // no same-model retry: go to the next model
            }
            if (!(err?.overloaded || isOverloaded(err))) throw err;
            lastErr = err;
          }
        }
      }
      // Every model is exhausted: preview mode until the first one is usable again. Otherwise some were just failing.
      if (!history.model && models.every(isExhausted)) {
        const soonest = Math.min(...models.map((m) => exhaustedUntil.get(m)));
        throw new GeminiExhaustedError(models, Math.max(1, Math.ceil((soonest - now()) / 1000)), lastErr);
      }
      throw new GeminiUnavailableError(candidates.length ? candidates : models, lastErr);
    },

    // The model's turn unchanged, then one user turn with a functionResponse per call, in the same order.
    withToolResults: (history, turn, results) => ({
      model: turn.model,
      contents: [
        ...history.contents,
        { role: "model", parts: turn.content },
        {
          role: "user",
          parts: results.map(({ call, output, error }) => ({
            functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response: error ? { error } : { output } },
          })),
        },
      ],
    }),

    classifyError(err) {
      if (err?.name === "AbortError") return "aborted";
      // 429 RESOURCE_EXHAUSTED: the free tier's per-minute or per-day quota is used up.
      if (err instanceof GeminiExhaustedError) return "quota";
      if (err instanceof GeminiUnavailableError) return "unavailable";
      // A 5xx, or a 429 too late in the reply to switch models.
      if ((err instanceof ApiError && err.status >= 500) || isOverloaded(err) || err?.overloaded || isQuota(err)) return "busy";
      return "other";
    },

    describeError: (err) =>
      err instanceof GeminiUnavailableError || err instanceof GeminiExhaustedError
        ? `${err.message}: ${err.cause instanceof ApiError ? err.cause.status : err.cause?.message ?? "-"}`
        : err instanceof ApiError
          ? `${err.status} ${err.message.slice(0, 300)}`
          : err,
    retryAfterSeconds,
  };
}
