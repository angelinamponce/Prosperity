// Run with `npm run test:server`. Uses fake Claude and Gemini clients, so no API key or network is needed.
import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import { ApiError } from "@google/genai";
import { createDailyBudget } from "./budget.mjs";
import { cleanMessages, clientIp, createSproutHandler } from "./chat.mjs";
import { createAnthropicProvider } from "./llm/anthropic.mjs";
import { createGeminiClient, createGeminiProvider, nextPacificMidnight, retryAfterSeconds } from "./llm/gemini.mjs";
import { createLlm } from "./llm/index.mjs";
import { createRateLimiter } from "./rateLimit.mjs";
import { sampleProfile } from "../src/dashboard/sampleProfile.js";

const quiet = { info() {}, error() {} };

const claude = (client, model) => createAnthropicProvider({ client, model });

/** A stand-in for client.beta.messages.stream: plays back scripted turns and records each request. */
function fakeClient(turns) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        stream(params) {
          calls.push(structuredClone(params));
          const turn = turns.shift();
          const handlers = [];
          return {
            on(event, fn) {
              if (event === "text") handlers.push(fn);
              return this;
            },
            async finalMessage() {
              if (turn instanceof Error) throw turn;
              for (const block of turn.content) if (block.type === "text") for (const fn of handlers) fn(block.text);
              return { usage: { input_tokens: 100, output_tokens: 20 }, ...turn };
            },
          };
        },
      },
    },
  };
}

async function withServer(handler, fn) {
  const server = http.createServer(async (req, res) => {
    if (!(await handler(req, res))) res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, r));
  try {
    return await fn(`http://localhost:${server.address().port}`);
  } finally {
    server.close();
  }
}

const post = (base, body) =>
  fetch(`${base}/api/sprout/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** The stream's events. `done` carries the serving model; tests that care read it from `served`. */
const events = async (res) => {
  const evs = (await res.text())
    .split("\n\n")
    .filter(Boolean)
    .map((b) => JSON.parse(b.replace(/^data: /, "")));
  const done = evs.find((e) => e.type === "done");
  const out = evs.map((e) => (e.type === "done" ? { type: "done" } : e));
  return Object.defineProperty(out, "served", { value: done?.model }); // not enumerable, so deepEqual ignores it
};

const ask = (text) => ({ messages: [{ role: "user", content: text }], context: { profile: sampleProfile, plan: { extraDebt: 300, strategy: "avalanche" } } });

test("status reports whether a key is configured", async () => {
  await withServer(createSproutHandler({ llm: null, log: quiet }), async (base) => {
    assert.deepEqual(await (await fetch(`${base}/api/sprout/status`)).json(), { live: false });
    const res = await post(base, ask("hi"));
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, "not_configured");
  });
});

test("runs the debt tool server-side, streams the pill and the answer", async () => {
  const client = fakeClient([
    {
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "t1", name: "simulate_debt_payoff", input: { extra_monthly_payment: 300, strategy: "avalanche" } }],
    },
    { stop_reason: "end_turn", content: [{ type: "text", text: "You'd be debt-free soon." }] },
  ]);
  await withServer(createSproutHandler({ llm: claude(client), log: quiet }), async (base) => {
    const evs = await events(await post(base, ask("If I put $300 extra toward debt, when am I debt-free?")));
    assert.deepEqual(evs[0], { type: "tool", name: "simulate_debt_payoff", label: "Debt payoff calculator", summary: "extra $300/mo · highest interest first" });
    assert.deepEqual(evs.slice(1), [{ type: "text", text: "You'd be debt-free soon." }, { type: "done" }]);
  });
  // Second request carries the assistant turn and the calculator's result.
  const [first, second] = client.calls;
  assert.equal(first.model, "claude-sonnet-5-5");
  assert.equal(first.system[0].cache_control.type, "ephemeral");
  assert.match(first.system[1].text, /Credit card: balance \$3,200, 22\.9% APR/);
  const result = second.messages.at(-1).content[0];
  assert.equal(result.tool_use_id, "t1");
  assert.match(JSON.parse(result.content).debt_free_date, /^[A-Z][a-z]{2} \d{4}$/);
});

test("model comes from SPROUT_MODEL-style config", async () => {
  const client = fakeClient([{ stop_reason: "end_turn", content: [{ type: "text", text: "Hi!" }] }]);
  await withServer(createSproutHandler({ llm: claude(client, "claude-haiku-5-5"), log: quiet }), async (base) => {
    await events(await post(base, ask("hello")));
  });
  assert.equal(client.calls[0].model, "claude-haiku-5-5");
});

test("upstream failures become a friendly in-chat error, never a raw one", async () => {
  const client = fakeClient([new Error("socket hang up: secret internals")]);
  await withServer(createSproutHandler({ llm: claude(client), log: quiet }), async (base) => {
    const evs = await events(await post(base, ask("hello")));
    assert.deepEqual(evs, [{ type: "error", message: "Sprout couldn't answer just now. Please try again in a moment." }]);
  });
});

test("refusals end with a friendly redirect", async () => {
  const client = fakeClient([{ stop_reason: "refusal", content: [] }]);
  await withServer(createSproutHandler({ llm: claude(client), log: quiet }), async (base) => {
    const evs = await events(await post(base, ask("something odd")));
    assert.equal(evs[0].type, "error");
    assert.match(evs[0].message, /budget, debt, savings/);
  });
});

test("rejects long messages and enforces the rate limit", async () => {
  const client = fakeClient(Array.from({ length: 5 }, () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] })));
  const limiter = createRateLimiter({ perMinute: 2, perDay: 100 });
  await withServer(createSproutHandler({ llm: claude(client), limiter, log: quiet }), async (base) => {
    assert.equal((await post(base, ask("x".repeat(1001)))).status, 413);
    assert.equal((await post(base, ask("one"))).status, 200);
    const limited = await post(base, ask("two"));
    assert.equal(limited.status, 429);
    assert.match((await limited.json()).error, /quickly/);
  });
});

test("history is trimmed to the last 20 turns and starts with the user", () => {
  const long = Array.from({ length: 31 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  const out = cleanMessages(long);
  assert.ok(out.length <= 20);
  assert.equal(out[0].role, "user");
  assert.equal(out.at(-1).content, "m30");
  assert.throws(() => cleanMessages([{ role: "assistant", content: "hi" }]));
  // Two user turns in a row (after a failed reply) are merged so roles alternate.
  assert.deepEqual(cleanMessages([{ role: "user", content: "a" }, { role: "user", content: "b" }]), [{ role: "user", content: "a\n\nb" }]);
});

test("rate limiter allows again after a minute", () => {
  let t = 0;
  const lim = createRateLimiter({ perMinute: 1, perDay: 10, now: () => t });
  assert.ok(lim.take("ip").ok);
  assert.equal(lim.take("ip").ok, false);
  t = 61_000;
  assert.ok(lim.take("ip").ok);
});

const PAGES = "https://angelinamponce.github.io";
const okClient = () => fakeClient(Array.from({ length: 5 }, () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] })));
const fromOrigin = (base, origin, body = ask("hi")) =>
  fetch(`${base}/api/sprout/chat`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });

test("/healthz answers 200 even without a key, for Render and the wake-up ping", async () => {
  await withServer(createSproutHandler({ llm: null, allowedOrigins: [PAGES], log: quiet }), async (base) => {
    const res = await fetch(`${base}/healthz`, { headers: { Origin: PAGES } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(res.headers.get("access-control-allow-origin"), PAGES);
  });
});

test("CORS: GitHub Pages is allowed, other sites are refused", async () => {
  await withServer(createSproutHandler({ llm: claude(okClient()), allowedOrigins: [PAGES], allowLocalhost: false, log: quiet }), async (base) => {
    const ok = await fromOrigin(base, PAGES);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("access-control-allow-origin"), PAGES);
    await ok.text();

    const evil = await fromOrigin(base, "https://evil.example");
    assert.equal(evil.status, 403);
    assert.equal(evil.headers.get("access-control-allow-origin"), null);

    const preflight = (origin) =>
      fetch(`${base}/api/sprout/chat`, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST" } });
    assert.equal((await preflight(PAGES)).status, 204);
    assert.equal((await preflight("https://evil.example")).status, 403);
    // In production, localhost is just another foreign site.
    assert.equal((await fromOrigin(base, "http://localhost:3000")).status, 403);
  });
});

test("CORS: localhost on any port is allowed outside production", async () => {
  await withServer(createSproutHandler({ llm: claude(okClient()), allowedOrigins: [PAGES], allowLocalhost: true, log: quiet }), async (base) => {
    const res = await fromOrigin(base, "http://localhost:3000");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:3000");
    await res.text();
  });
});

test("behind Render's proxy the rate limit keys on the visitor, not the proxy", async () => {
  const limiter = createRateLimiter({ perMinute: 1, perDay: 100 });
  await withServer(createSproutHandler({ llm: claude(okClient()), limiter, trustProxy: true, log: quiet }), async (base) => {
    const as = (ip) => fetch(`${base}/api/sprout/chat`, { method: "POST", headers: { "CF-Connecting-IP": ip }, body: JSON.stringify(ask("hi")) });
    assert.equal((await as("1.1.1.1")).status, 200);
    assert.equal((await as("2.2.2.2")).status, 200);
    assert.equal((await as("1.1.1.1")).status, 429);
  });
});

const warnings = () => {
  const lines = [];
  return { lines, info() {}, error() {}, warn: (l) => lines.push(l) };
};

test("daily message cap: once used up, chat gets the friendly 503 and status reports not live", async () => {
  const log = warnings();
  const budget = createDailyBudget({ messageCap: 2, tokenCap: 1e9, log });
  await withServer(createSproutHandler({ llm: claude(okClient()), budget, log }), async (base) => {
    assert.equal((await post(base, ask("one"))).status, 200);
    assert.equal((await post(base, ask("two"))).status, 200);
    const third = await post(base, ask("three"));
    assert.equal(third.status, 503);
    assert.deepEqual(await third.json(), { error: "Sprout's live answers are resting until tomorrow.", code: "daily_cap" });
    assert.deepEqual(await (await fetch(`${base}/api/sprout/status`)).json(), { live: false });
  });
  assert.equal(log.lines.length, 1, "logs once when the cap trips");
  assert.match(log.lines[0], /daily cap reached .*2\/2 messages/);
});

test("daily token cap: replies that use up the token budget trip it", async () => {
  const log = warnings();
  // Each fake reply reports 100 input + 20 output tokens.
  const budget = createDailyBudget({ messageCap: 1000, tokenCap: 200, log });
  await withServer(createSproutHandler({ llm: claude(okClient()), budget, log }), async (base) => {
    await (await post(base, ask("one"))).text(); // 120 tokens
    await (await post(base, ask("two"))).text(); // 240 tokens: over
    assert.equal((await post(base, ask("three"))).status, 503);
  });
  assert.match(log.lines[0], /240\/200 tokens/);
});

test("daily caps reset at midnight UTC", () => {
  let t = Date.UTC(2026, 9, 26, 23, 59);
  const budget = createDailyBudget({ messageCap: 1, tokenCap: 100, now: () => t, log: warnings() });
  assert.ok(budget.takeMessage());
  assert.equal(budget.takeMessage(), false);
  assert.ok(budget.exhausted());
  t = Date.UTC(2026, 9, 27, 0, 0);
  assert.equal(budget.exhausted(), false);
  assert.ok(budget.takeMessage());
});

test("in production, chat without an Origin header is refused but health and status stay open", async () => {
  await withServer(createSproutHandler({ llm: claude(okClient()), allowedOrigins: [PAGES], allowLocalhost: false, requireOrigin: true, log: quiet }), async (base) => {
    const noOrigin = await post(base, ask("hi"));
    assert.equal(noOrigin.status, 403);
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.equal((await fetch(`${base}/api/sprout/status`)).status, 200);
    const fromPages = await fromOrigin(base, PAGES);
    assert.equal(fromPages.status, 200);
    await fromPages.text();
  });
});

test("rate-limit key: CF-Connecting-IP when it's a real IP, otherwise the socket address", () => {
  const req = (cf) => ({ headers: cf === undefined ? {} : { "cf-connecting-ip": cf }, socket: { remoteAddress: "10.0.0.9" } });
  assert.equal(clientIp(req("203.0.113.7"), true), "203.0.113.7");
  assert.equal(clientIp(req("2001:db8::1"), true), "2001:db8::1");
  assert.equal(clientIp(req(undefined), true), "10.0.0.9");
  assert.equal(clientIp(req("not-an-ip"), true), "10.0.0.9");
  assert.equal(clientIp(req("1.2.3.4, 5.6.7.8"), true), "10.0.0.9");
  // Without a trusted proxy the header is ignored.
  assert.equal(clientIp(req("203.0.113.7"), false), "10.0.0.9");
});

// ---------- Gemini ----------

/** A stand-in for client.models.generateContentStream: each turn is a list of response chunks (or an Error to throw). */
function fakeGemini(turns) {
  const calls = [];
  return {
    calls,
    models: {
      async generateContentStream(params) {
        const { abortSignal, ...rest } = params.config;
        calls.push(structuredClone({ ...params, config: rest }));
        const turn = turns.shift();
        if (turn instanceof Error) throw turn;
        if (turn?.hang) {
          await new Promise((_, reject) => abortSignal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
        }
        return (async function* () {
          for (const chunk of turn) {
            if (chunk instanceof Error) throw chunk;
            yield chunk;
          }
        })();
      },
    },
  };
}

const chunk = (parts, extra = {}) => ({ candidates: [{ content: { role: "model", parts }, ...extra }] });
const usageChunk = (parts, finishReason = "STOP") => ({
  ...chunk(parts, { finishReason }),
  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 15, thoughtsTokenCount: 5 },
});
const gemini = (client, opts = {}) => createGeminiProvider({ client, backoffMs: 0, log: quiet, ...opts });
const overloaded = () =>
  new ApiError({ status: 503, message: JSON.stringify({ error: { code: 503, message: "This model is currently experiencing high demand.", status: "UNAVAILABLE" } }) });
/** A request that never answers until it's aborted (by the deadline or the user's Stop). */
const hangs = () => ({ hang: true });
const infoLog = () => {
  const lines = [];
  return { lines, info: (l) => lines.push(l), error() {}, warn: (l) => lines.push(l) };
};
const quotaError = () =>
  new ApiError({
    status: 429,
    message: JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "7s" }] } }),
  });

test("Gemini: runs the debt tool server-side and sends the result back with the call's id and thought signature", async () => {
  const client = fakeGemini([
    [usageChunk([{ functionCall: { id: "c1", name: "simulate_debt_payoff", args: { extra_monthly_payment: 300, strategy: "avalanche" } }, thoughtSignature: "sig-1" }])],
    [chunk([{ text: "You'd be " }]), usageChunk([{ text: "debt-free soon." }])],
  ]);
  await withServer(createSproutHandler({ llm: gemini(client), log: quiet }), async (base) => {
    const evs = await events(await post(base, ask("If I put $300 extra toward debt, when am I debt-free?")));
    assert.deepEqual(evs[0], { type: "tool", name: "simulate_debt_payoff", label: "Debt payoff calculator", summary: "extra $300/mo · highest interest first" });
    assert.deepEqual(evs.slice(1), [{ type: "text", text: "You'd be " }, { type: "text", text: "debt-free soon." }, { type: "done" }]);
  });
  const [first, second] = client.calls;
  assert.equal(first.model, "gemini-3.5-flash-lite");
  assert.deepEqual(first.contents, [{ role: "user", parts: [{ text: "If I put $300 extra toward debt, when am I debt-free?" }] }]);
  assert.match(first.config.systemInstruction, /Never do financial arithmetic yourself/);
  assert.match(first.config.systemInstruction, /Credit card: balance \$3,200, 22\.9% APR/);
  assert.deepEqual(first.config.thinkingConfig, { thinkingLevel: "LOW" });
  assert.equal(first.config.toolConfig, undefined);
  const decl = first.config.tools[0].functionDeclarations.find((d) => d.name === "simulate_debt_payoff");
  assert.deepEqual(decl.parametersJsonSchema.required, ["extra_monthly_payment", "strategy"]);
  assert.equal(decl.eager_input_streaming, undefined);

  const [, modelTurn, results] = second.contents;
  assert.equal(modelTurn.role, "model");
  assert.equal(modelTurn.parts[0].thoughtSignature, "sig-1");
  const fr = results.parts[0].functionResponse;
  assert.equal(results.role, "user");
  assert.equal(fr.id, "c1");
  assert.equal(fr.name, "simulate_debt_payoff");
  assert.match(fr.response.output.debt_free_date, /^[A-Z][a-z]{2} \d{4}$/);
});

test("Gemini: after four calculator rounds, tool calls are switched off for the final answer", async () => {
  const call = () => [usageChunk([{ functionCall: { name: "get_plan_summary", args: {} } }])];
  const client = fakeGemini([call(), call(), call(), call(), [usageChunk([{ text: "Here's your picture." }])]]);
  await withServer(createSproutHandler({ llm: gemini(client), log: quiet }), async (base) => {
    const evs = await events(await post(base, ask("How am I doing?")));
    assert.equal(evs.filter((e) => e.type === "tool").length, 4);
    assert.deepEqual(evs.slice(-2), [{ type: "text", text: "Here's your picture." }, { type: "done" }]);
  });
  assert.equal(client.calls.length, 5);
  assert.deepEqual(client.calls[4].config.toolConfig, { functionCallingConfig: { mode: "NONE" } });
  // Calls without an id get a response without one (matched by name and order).
  assert.equal(client.calls[1].contents.at(-1).parts[0].functionResponse.id, undefined);
});

const FIRST = "gemini-3.5-flash-lite";
const SECOND = "gemini-3.8-flash";
const dailyQuotaError = () =>
  new ApiError({
    status: 429,
    message: JSON.stringify({
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }],
      },
    }),
  });

test("Gemini: a 429 on the first model is served by the next one, and the log names both", async () => {
  const log = infoLog();
  const client = fakeGemini([quotaError(), [usageChunk([{ text: "From Flash." }])]]);
  await withServer(createSproutHandler({ llm: gemini(client, { log }), log }), async (base) => {
    assert.deepEqual(await events(await post(base, ask("hi"))), [{ type: "text", text: "From Flash." }, { type: "done" }]);
    // One model used up isn't a reason for preview mode.
    assert.deepEqual(await (await fetch(`${base}/api/sprout/status`)).json(), { live: true });
  });
  assert.deepEqual(client.calls.map((c) => c.model), [FIRST, SECOND], "no same-model retry on a 429");
  assert.ok(log.lines.includes(`[sprout] gemini 429 from ${FIRST} (rate limit); skipping it for 7s`), log.lines.join("\n"));
  assert.match(log.lines.find((l) => l.includes("rounds=")), new RegExp(`model=${SECOND.replace(/\./g, "\\.")} rounds=1`));
});

test("Gemini: an exhausted model is skipped by the next requests until its retry delay passes", async () => {
  let t = 1_000_000;
  const client = fakeGemini([quotaError(), [usageChunk([{ text: "one" }])], [usageChunk([{ text: "two" }])], [usageChunk([{ text: "three" }])]]);
  await withServer(createSproutHandler({ llm: gemini(client, { now: () => t }), log: quiet, now: () => t }), async (base) => {
    await (await post(base, ask("one"))).text();
    t += 6_000;
    await (await post(base, ask("two"))).text();
    t += 1_000; // 7s: Google's retry delay has passed
    await (await post(base, ask("three"))).text();
  });
  assert.deepEqual(client.calls.map((c) => c.model), [FIRST, SECOND, SECOND, FIRST]);
});

test("Gemini: a per-day quota skips that model until midnight Pacific", async () => {
  let t = Date.UTC(2026, 9, 26, 20, 0); // 1pm PDT
  const log = infoLog();
  const client = fakeGemini([dailyQuotaError(), ...Array.from({ length: 3 }, () => [usageChunk([{ text: "ok" }])])]);
  await withServer(createSproutHandler({ llm: gemini(client, { now: () => t, log }), log: quiet, now: () => t }), async (base) => {
    await (await post(base, ask("one"))).text();
    t = Date.UTC(2026, 9, 27, 6, 59); // 11:59pm PDT: still skipped
    await (await post(base, ask("two"))).text();
    t = Date.UTC(2026, 9, 27, 7, 0); // midnight PDT
    await (await post(base, ask("three"))).text();
  });
  assert.deepEqual(client.calls.map((c) => c.model), [FIRST, SECOND, SECOND, FIRST]);
  assert.ok(log.lines.includes(`[sprout] gemini 429 from ${FIRST} (daily quota); skipping it for 39600s`), log.lines.join("\n"));
});

test("midnight Pacific follows daylight saving time", () => {
  assert.equal(nextPacificMidnight(Date.UTC(2026, 9, 26, 20, 0)), Date.UTC(2026, 9, 27, 7, 0)); // PDT
  assert.equal(nextPacificMidnight(Date.UTC(2026, 11, 1, 9, 30)), Date.UTC(2026, 11, 2, 8, 0)); // PST, 1:30am
  assert.equal(nextPacificMidnight(Date.UTC(2026, 11, 2, 7, 59)), Date.UTC(2026, 11, 2, 8, 0)); // 11:59pm PST
});

test("Gemini: when every model is out of quota the visitor gets the preview 503 until the first one frees up", async () => {
  let t = 1_000_000;
  const client = fakeGemini([quotaError(), quotaError(), [usageChunk([{ text: "Back again." }])]]);
  await withServer(createSproutHandler({ llm: gemini(client, { now: () => t }), log: quiet, now: () => t }), async (base) => {
    const res = await post(base, ask("hi"));
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "Sprout is helping a lot of people right now. Please try again in a minute.", code: "daily_cap" });
    assert.deepEqual(await (await fetch(`${base}/api/sprout/status`)).json(), { live: false });
    // While paused, Gemini isn't called at all.
    assert.equal((await post(base, ask("hi again"))).status, 503);
    assert.deepEqual(client.calls.map((c) => c.model), [FIRST, SECOND]);

    t += 7_000;
    assert.deepEqual(await (await fetch(`${base}/api/sprout/status`)).json(), { live: true });
    assert.deepEqual(await events(await post(base, ask("hello"))), [{ type: "text", text: "Back again." }, { type: "done" }]);
  });
  assert.equal(client.calls.at(-1).model, FIRST);
});

test("Gemini: one model out of quota and the other overloaded still means preview, without pausing", async () => {
  const client = fakeGemini([quotaError(), overloaded(), overloaded()]);
  await withServer(createSproutHandler({ llm: gemini(client), log: quiet }), async (base) => {
    const res = await post(base, ask("hi"));
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, "daily_cap");
    assert.deepEqual(await (await fetch(`${base}/api/sprout/status`)).json(), { live: true });
  });
  assert.deepEqual(client.calls.map((c) => c.model), [FIRST, SECOND, SECOND]);
});

test("Gemini: a 429 in a later round of a reply doesn't switch models; it ends with the busy message", async () => {
  const client = fakeGemini([[usageChunk([{ functionCall: { id: "c1", name: "get_plan_summary", args: {} } }])], quotaError()]);
  await withServer(createSproutHandler({ llm: gemini(client), log: quiet }), async (base) => {
    const evs = await events(await post(base, ask("How am I doing?")));
    assert.equal(evs[0].type, "tool");
    assert.deepEqual(evs.at(-1), { type: "error", message: "Sprout is helping a lot of people right now. Please try again in a minute." });
  });
  assert.deepEqual(client.calls.map((c) => c.model), [FIRST, FIRST]);
});

test("Gemini: a 429 after text has streamed ends the reply with the friendly busy message", async () => {
  const client = fakeGemini([[chunk([{ text: "Let me check" }]), quotaError()]]);
  await withServer(createSproutHandler({ llm: gemini(client), log: { info() {}, error() {}, warn() {} } }), async (base) => {
    const evs = await events(await post(base, ask("hi")));
    assert.deepEqual(evs, [
      { type: "text", text: "Let me check" },
      { type: "error", message: "Sprout is helping a lot of people right now. Please try again in a minute." },
    ]);
  });
});

test("Gemini: safety blocks end with the friendly redirect; other failures stay generic", async () => {
  const client = fakeGemini([[usageChunk([], "SAFETY")], [{ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } }], new ApiError({ status: 400, message: "bad request: internals" })]);
  await withServer(createSproutHandler({ llm: gemini(client), log: quiet }), async (base) => {
    for (let i = 0; i < 2; i += 1) {
      const evs = await events(await post(base, ask("something odd")));
      assert.equal(evs[0].type, "error");
      assert.match(evs[0].message, /budget, debt, savings/);
    }
    assert.deepEqual(await events(await post(base, ask("hello"))), [{ type: "error", message: "Sprout couldn't answer just now. Please try again in a moment." }]);
  });
});

test("Gemini usage counts toward the daily token cap", async () => {
  const log = warnings();
  const budget = createDailyBudget({ messageCap: 1000, tokenCap: 200, log });
  const client = fakeGemini([[usageChunk([{ text: "a" }])], [usageChunk([{ text: "b" }])]]);
  await withServer(createSproutHandler({ llm: gemini(client), budget, log }), async (base) => {
    await (await post(base, ask("one"))).text(); // 100 in + 20 out
    await (await post(base, ask("two"))).text(); // 240: over
    assert.equal((await post(base, ask("three"))).status, 503);
  });
  assert.match(log.lines[0], /240\/200 tokens/);
});

test("retry delay is read from Gemini's RetryInfo", () => {
  assert.equal(retryAfterSeconds(quotaError()), 7);
  assert.equal(retryAfterSeconds(new Error("RESOURCE_EXHAUSTED")), null);
});

test("SPROUT_LLM_PROVIDER picks the provider; Gemini is the default", () => {
  assert.equal(createLlm({ env: {} }), null, "no key: preview mode");
  const g = createLlm({ env: { GEMINI_API_KEY: "test" } });
  assert.equal(g.name, "gemini");
  assert.deepEqual(g.models, ["gemini-3.5-flash-lite", "gemini-3.8-flash"]);
  assert.deepEqual(createLlm({ env: { GEMINI_API_KEY: "test", SPROUT_GEMINI_MODELS: " gemini-3.8-flash, ,gemini-3.6-flash " } }).models, ["gemini-3.8-flash", "gemini-3.6-flash"]);
  assert.equal(createLlm({ env: { SPROUT_LLM_PROVIDER: "anthropic", GEMINI_API_KEY: "test" } }), null, "each provider needs its own key");
  const a = createLlm({ env: { SPROUT_LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "test" } });
  assert.deepEqual([a.name, a.model], ["anthropic", "claude-sonnet-5-5"]);
  assert.throws(() => createLlm({ env: { SPROUT_LLM_PROVIDER: "openai" } }), /must be one of gemini, anthropic/);
});

test("Gemini: a 503 before anything streamed retries once, then the next model answers", async () => {
  const log = infoLog();
  const client = fakeGemini([overloaded(), overloaded(), [usageChunk([{ text: "Hi from Flash." }])]]);
  await withServer(createSproutHandler({ llm: gemini(client), log }), async (base) => {
    const evs = await events(await post(base, ask("hi")));
    assert.deepEqual(evs, [{ type: "text", text: "Hi from Flash." }, { type: "done" }]);
  });
  assert.deepEqual(client.calls.map((c) => c.model), ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite", "gemini-3.8-flash"]);
  assert.match(log.lines.find((l) => l.includes("rounds=")), /model=gemini-3\.8-flash rounds=1/);
});

test("Gemini: a retry on the same model can succeed without falling back", async () => {
  const client = fakeGemini([overloaded(), [usageChunk([{ text: "Second try." }])]]);
  await withServer(createSproutHandler({ llm: gemini(client), log: quiet }), async (base) => {
    assert.deepEqual(await events(await post(base, ask("hi"))), [{ type: "text", text: "Second try." }, { type: "done" }]);
  });
  assert.deepEqual(client.calls.map((c) => c.model), ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite"]);
});

test("Gemini: when every model is overloaded the visitor gets the friendly 503 and preview replies", async () => {
  const log = infoLog();
  const client = fakeGemini([overloaded(), overloaded(), overloaded(), overloaded()]);
  await withServer(createSproutHandler({ llm: gemini(client), log }), async (base) => {
    const res = await post(base, ask("hi"));
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "Sprout is helping a lot of people right now. Please try again in a minute.", code: "daily_cap" });
    // Overload isn't a quota: the next visitor tries again.
    assert.deepEqual(await (await fetch(`${base}/api/sprout/status`)).json(), { live: true });
  });
  assert.equal(client.calls.length, 4);
  assert.ok(log.lines.some((l) => /Gemini unavailable \(tried gemini-3\.5-flash-lite, gemini-3\.8-flash\): 503/.test(l)));
});

test("Gemini: a request that doesn't start within the time limit counts as overloaded, and the wait is capped", async () => {
  const client = fakeGemini([hangs(), hangs(), hangs(), hangs()]);
  const started = Date.now();
  await withServer(createSproutHandler({ llm: gemini(client, { firstOutputMs: 150 }), log: infoLog() }), async (base) => {
    const res = await post(base, ask("hi"));
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, "daily_cap");
  });
  assert.ok(Date.now() - started < 1000, "the whole fallback chain shares one time limit");
});

test("Gemini: later rounds of a reply stay on the model that answered the first", async () => {
  const client = fakeGemini([
    overloaded(),
    overloaded(),
    [usageChunk([{ functionCall: { id: "c1", name: "get_plan_summary", args: {} }, thoughtSignature: "flash-sig" }])],
    [usageChunk([{ text: "Here's your picture." }])],
  ]);
  await withServer(createSproutHandler({ llm: gemini(client), log: quiet }), async (base) => {
    const evs = await events(await post(base, ask("How am I doing?")));
    assert.deepEqual(evs.slice(-2), [{ type: "text", text: "Here's your picture." }, { type: "done" }]);
  });
  assert.deepEqual(client.calls.map((c) => c.model), ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.8-flash"]);
});

test("Gemini: a 503 after text has streamed doesn't switch models mid-answer", async () => {
  const client = fakeGemini([[chunk([{ text: "Let me" }]), overloaded()]]);
  await withServer(createSproutHandler({ llm: gemini(client), log: quiet }), async (base) => {
    assert.deepEqual(await events(await post(base, ask("hi"))), [
      { type: "text", text: "Let me" },
      { type: "error", message: "Sprout is helping a lot of people right now. Please try again in a minute." },
    ]);
  });
  assert.equal(client.calls.length, 1);
});

test("the real Gemini SDK client makes one request per try (retrying is ours, not the SDK's)", async () => {
  let requests = 0;
  const fetch503 = async () => {
    requests += 1;
    return new Response(JSON.stringify({ error: { code: 503, message: "high demand", status: "UNAVAILABLE" } }), { status: 503, headers: { "Content-Type": "application/json" } });
  };
  const client = createGeminiClient("test-key", fetch503);
  await assert.rejects(client.models.generateContentStream({ model: "gemini-3.5-flash-lite", contents: "hi" }), (err) => err.status === 503);
  assert.equal(requests, 1);
});

test("Gemini: a first model that hangs only uses its share of the time limit, then the next model answers", async () => {
  const client = fakeGemini([hangs(), [usageChunk([{ text: "Flash here." }])]]);
  const started = Date.now();
  await withServer(createSproutHandler({ llm: gemini(client, { firstOutputMs: 400 }), log: quiet }), async (base) => {
    assert.deepEqual(await events(await post(base, ask("hi"))), [{ type: "text", text: "Flash here." }, { type: "done" }]);
  });
  const took = Date.now() - started;
  assert.ok(took >= 180 && took < 400, `the hanging model got about half the limit (took ${took}ms)`);
  assert.deepEqual(client.calls.map((c) => c.model), ["gemini-3.5-flash-lite", "gemini-3.8-flash"]);
});

test("the done event names the model that served the reply", async () => {
  const g = fakeGemini([overloaded(), overloaded(), [usageChunk([{ text: "Hi." }])]]);
  await withServer(createSproutHandler({ llm: gemini(g), log: quiet }), async (base) => {
    assert.equal((await events(await post(base, ask("hi")))).served, "gemini-3.8-flash");
  });
  const c = fakeClient([{ stop_reason: "end_turn", model: "claude-sonnet-5-5", content: [{ type: "text", text: "Hi." }] }]);
  await withServer(createSproutHandler({ llm: claude(c), log: quiet }), async (base) => {
    assert.equal((await events(await post(base, ask("hi")))).served, "claude-sonnet-5-5");
  });
});
