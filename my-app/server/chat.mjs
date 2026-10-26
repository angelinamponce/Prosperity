// POST /api/sprout/chat: streams Sprout's reply as server-sent events, running Prosperity's calculators as model tools.
// The model comes from ./llm (Gemini by default, or Claude); the tool loop, caps and checks here are the same for both.
// GET /api/sprout/status: tells the browser whether the live assistant is available (no key, today's budget used up,
// or the provider's quota used up, means scripted preview mode).
// GET /healthz: Render's health check, and the ping the chat sends on open to wake a sleeping free instance.
//
// Events (one JSON object per "data:" line), the same ones the scripted preview emits:
//   { type: "text", text } | { type: "tool", name, label, summary } | { type: "done" } | { type: "error", message }

import { isIP } from "node:net";
import { TOOL_DEFS, planSnapshot, readContext, runTool, toolPill } from "../src/sprout/tools.js";
import { SPROUT_SYSTEM, snapshotBlock } from "./prompts/sprout.mjs";
import { createDailyBudget } from "./budget.mjs";
import { createLlm } from "./llm/index.mjs";
import { createRateLimiter } from "./rateLimit.mjs";

export const MAX_MESSAGE_LENGTH = 1000; // matches the chat box
export const HISTORY_SENT = 20;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_REPLY_LENGTH = 8000; // earlier Sprout replies sent back as history
const MAX_TOOL_ROUNDS = 4;
const QUOTA_PAUSE_SECONDS = 60; // after a provider 429, when it doesn't say how long to wait

const FRIENDLY = {
  generic: "Sprout couldn't answer just now. Please try again in a moment.",
  busy: "Sprout is helping a lot of people right now. Please try again in a minute.",
  slowDown: "You're sending messages quickly. Take a breath and try again in a minute.",
  tooLong: `Please keep your message under ${MAX_MESSAGE_LENGTH.toLocaleString("en-US")} characters.`,
  bad: "Sprout couldn't read that message. Please try again.",
  offline: "Sprout's live answers aren't turned on here yet.",
  resting: "Sprout's live answers are resting until tomorrow.",
  refused: "Sprout can't help with that one. Try asking about your budget, debt, savings or investing.",
  forbidden: "Sprout only answers questions from the Prosperity app.",
};

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

class BadRequest extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Keeps the last turns, checks lengths, and makes sure the history starts and ends with the user. */
export function cleanMessages(raw) {
  if (!Array.isArray(raw)) throw new BadRequest(FRIENDLY.bad);
  const msgs = raw.slice(-HISTORY_SENT).map((m) => {
    const role = m?.role === "assistant" ? "assistant" : m?.role === "user" ? "user" : null;
    const content = typeof m?.content === "string" ? m.content.trim() : "";
    if (!role || !content) throw new BadRequest(FRIENDLY.bad);
    if (role === "user" && content.length > MAX_MESSAGE_LENGTH) throw new BadRequest(FRIENDLY.tooLong, 413);
    return { role, content: role === "assistant" ? content.slice(0, MAX_REPLY_LENGTH) : content };
  });
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") throw new BadRequest(FRIENDLY.bad);
  // Merge back-to-back turns from the same side (for example after a failed reply) so roles alternate.
  return msgs.reduce((out, m) => {
    const last = out[out.length - 1];
    if (last?.role === m.role) last.content += `\n\n${m.content}`;
    else out.push({ ...m });
    return out;
  }, []);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new BadRequest(FRIENDLY.tooLong, 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BadRequest(FRIENDLY.bad);
  }
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

// Behind Render's proxy the socket address is the proxy's. Cloudflare (in front of Render) overwrites CF-Connecting-IP,
// so use it when it holds a real IP address; otherwise fall back to the socket address.
export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const cf = String(req.headers["cf-connecting-ip"] ?? "").trim();
    if (isIP(cf)) return cf;
  }
  return req.socket.remoteAddress || "unknown";
}

/**
 * Builds the request handler. `llm` is injectable for tests; by default it's the provider SPROUT_LLM_PROVIDER picks
 * (see ./llm/index.mjs), or null when that provider has no key.
 * Returns false for paths it doesn't own.
 */
export function createSproutHandler({
  allowedOrigins = (process.env.SPROUT_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  trustProxy = process.env.SPROUT_TRUST_PROXY === "1",
  // Local dev servers (any localhost port) may call the API too, but never in production.
  allowLocalhost = process.env.NODE_ENV !== "production",
  // In production every chat request must come from an allowed site; scripts without an Origin header are refused.
  requireOrigin = process.env.NODE_ENV === "production",
  limiter = createRateLimiter({
    perMinute: Number(process.env.SPROUT_RATE_PER_MINUTE) || 8,
    perDay: Number(process.env.SPROUT_RATE_PER_DAY) || 80,
  }),
  llm = createLlm(),
  log = console,
  budget = createDailyBudget({
    messageCap: Number(process.env.SPROUT_DAILY_MESSAGE_CAP) || 300,
    tokenCap: Number(process.env.SPROUT_DAILY_TOKEN_CAP) || 1_500_000,
    log,
  }),
  now = () => Date.now(),
} = {}) {
  const live = Boolean(llm);
  // When the provider says its quota is used up (Gemini's free tier: 429 RESOURCE_EXHAUSTED), stop calling it for a while.
  let quotaPausedUntil = 0;
  const quotaPaused = () => now() < quotaPausedUntil;
  // The browser switches to scripted preview replies when it gets any of these. A provider quota pause reuses the
  // daily_cap code so the deployed site needs no change; the browser plays preview replies either way.
  const offline = (res, cors) => sendJson(res, 503, { error: FRIENDLY.offline, code: "not_configured" }, cors);
  const resting = (res, cors) => sendJson(res, 503, { error: FRIENDLY.resting, code: "daily_cap" }, cors);
  const overQuota = (res, cors) => sendJson(res, 503, { error: FRIENDLY.busy, code: "daily_cap" }, cors);

  async function chat(req, res, cors) {
    if (!live) return offline(res, cors);
    if (budget.exhausted()) return resting(res, cors);
    if (quotaPaused()) return overQuota(res, cors);
    const gate = limiter.take(clientIp(req, trustProxy));
    if (!gate.ok) return sendJson(res, 429, { error: FRIENDLY.slowDown }, { ...cors, "Retry-After": String(gate.retryAfter) });

    let messages;
    let ctx;
    try {
      const body = await readJson(req);
      messages = cleanMessages(body?.messages);
      ctx = readContext(body?.context);
    } catch (err) {
      if (err instanceof BadRequest) return sendJson(res, err.status, { error: err.message }, cors);
      throw err;
    }
    if (!budget.takeMessage()) return resting(res, cors);

    // The event stream opens with the first event, so a quota error before anything is sent can still be a plain 503.
    const openStream = () => {
      if (res.headersSent) return;
      res.writeHead(200, {
        ...cors,
        "Content-Type": "text/event-stream; charset=utf-8",
        // no-transform stops dev-server compression from buffering the stream.
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
    };
    const send = (ev) => {
      openStream();
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(ev)}\n\n`);
    };

    // Stop calling the model if the user hits Stop or closes the tab.
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) abort.abort();
    });

    const snapshot = snapshotBlock(planSnapshot(ctx));
    const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, rounds: 0, tools: [] };
    let wroteText = false;

    try {
      let history = llm.start(messages);
      for (let round = 0; ; round += 1) {
        const lastRound = round >= MAX_TOOL_ROUNDS;
        let roundHasText = false;
        const turn = await llm.turn({
          system: SPROUT_SYSTEM,
          snapshot,
          tools: TOOL_DEFS,
          history,
          lastRound,
          signal: abort.signal,
          onText(delta) {
            // Keep text from separate rounds (before and after a calculator) in separate paragraphs.
            if (!roundHasText && wroteText) send({ type: "text", text: "\n\n" });
            roundHasText = true;
            wroteText = true;
            send({ type: "text", text: delta });
          },
        });
        usage.rounds += 1;
        usage.input += turn.usage.input;
        usage.output += turn.usage.output;
        usage.cacheRead += turn.usage.cacheRead;
        usage.cacheWrite += turn.usage.cacheWrite;

        if (turn.stop === "refusal") {
          send({ type: "error", message: FRIENDLY.refused });
          break;
        }
        if (turn.stop === "failed") {
          send({ type: "error", message: FRIENDLY.generic });
          break;
        }
        if (!turn.toolCalls.length || lastRound) break;
        // A tool call cut off by max_tokens may have truncated input; don't run it.
        if (turn.stop === "max_tokens") {
          send({ type: "error", message: FRIENDLY.generic });
          break;
        }

        // The model never does the arithmetic: every number comes from runTool here on the server.
        const results = turn.toolCalls.map((call) => {
          send({ type: "tool", name: call.name, ...toolPill(call.name, call.input, ctx) });
          usage.tools.push(call.name);
          try {
            return { call, output: runTool(call.name, call.input, ctx) };
          } catch (err) {
            log.error("[sprout] tool failed", call.name, err);
            return { call, error: "The calculator failed. Don't guess the number; tell the user to try again." };
          }
        });
        history = llm.withToolResults(history, turn, results);
      }
      if (!abort.signal.aborted) send({ type: "done" });
    } catch (err) {
      const kind = abort.signal.aborted ? "aborted" : llm.classifyError(err);
      if (kind === "aborted") {
        // The user stopped the reply; nothing to report.
      } else if (kind === "quota") {
        const wait = llm.retryAfterSeconds?.(err) ?? QUOTA_PAUSE_SECONDS;
        quotaPausedUntil = now() + wait * 1000;
        log.warn?.(`[sprout] ${llm.name} quota used up (429); preview mode for ${wait}s`);
        // Nothing streamed yet: the same 503 as a used-up daily cap, so the browser answers with preview replies.
        if (!res.headersSent) overQuota(res, cors);
        else send({ type: "error", message: FRIENDLY.busy });
      } else if (kind === "busy") {
        log.error("[sprout] upstream busy", err?.status);
        send({ type: "error", message: FRIENDLY.busy });
      } else {
        log.error("[sprout] chat failed", llm.describeError(err));
        send({ type: "error", message: FRIENDLY.generic });
      }
    } finally {
      budget.addTokens(usage.input + usage.output + usage.cacheRead + usage.cacheWrite);
      log.info?.(
        `[sprout] ${llm.name}/${llm.model} rounds=${usage.rounds} tools=${usage.tools.join(",") || "-"} in=${usage.input} cache_read=${usage.cacheRead} cache_write=${usage.cacheWrite} out=${usage.output}`
      );
      if (!res.headersSent && !res.writableEnded) openStream();
      res.end();
    }
  }

  return async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname !== "/healthz" && !url.pathname.startsWith("/api/sprout/")) return false;

    const origin = req.headers.origin;
    const originAllowed = Boolean(origin) && (allowedOrigins.includes(origin) || (allowLocalhost && LOCALHOST.test(origin)));
    const cors = originAllowed
      ? {
          "Access-Control-Allow-Origin": origin,
          Vary: "Origin",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Max-Age": "600",
        }
      : { Vary: "Origin" };

    if (req.method === "OPTIONS") {
      res.writeHead(originAllowed ? 204 : 403, cors);
      res.end();
    } else if (url.pathname === "/healthz" && (req.method === "GET" || req.method === "HEAD")) {
      sendJson(res, 200, { ok: true }, { ...cors, "Cache-Control": "no-store" });
    } else if (url.pathname === "/api/sprout/status" && req.method === "GET") {
      sendJson(res, 200, { live: live && !budget.exhausted() && !quotaPaused() }, { ...cors, "Cache-Control": "no-store" });
    } else if (url.pathname === "/api/sprout/chat" && req.method === "POST") {
      // Other sites can't use the API (and spend the key's quota). In production, neither can scripts that send no Origin;
      // in development those (curl, tests) are allowed and still face the rate limit.
      if ((origin && !originAllowed) || (!origin && requireOrigin)) {
        sendJson(res, 403, { error: FRIENDLY.forbidden }, cors);
        return true;
      }
      try {
        await chat(req, res, cors);
      } catch (err) {
        log.error("[sprout] unexpected", err);
        if (!res.headersSent) sendJson(res, 500, { error: FRIENDLY.generic }, cors);
        else res.end();
      }
    } else {
      sendJson(res, 404, { error: "Not found" }, cors);
    }
    return true;
  };
}
