// Run with `npm run test:server`. Uses a fake Claude client, so no API key or network is needed.
import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import { createDailyBudget } from "./budget.mjs";
import { cleanMessages, clientIp, createSproutHandler } from "./chat.mjs";
import { createRateLimiter } from "./rateLimit.mjs";
import { sampleProfile } from "../src/dashboard/sampleProfile.js";

const quiet = { info() {}, error() {} };

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

const events = async (res) =>
  (await res.text())
    .split("\n\n")
    .filter(Boolean)
    .map((b) => JSON.parse(b.replace(/^data: /, "")));

const ask = (text) => ({ messages: [{ role: "user", content: text }], context: { profile: sampleProfile, plan: { extraDebt: 300, strategy: "avalanche" } } });

test("status reports whether a key is configured", async () => {
  await withServer(createSproutHandler({ client: null, log: quiet }), async (base) => {
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
  await withServer(createSproutHandler({ client, log: quiet }), async (base) => {
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
  await withServer(createSproutHandler({ client, model: "claude-haiku-5-5", log: quiet }), async (base) => {
    await events(await post(base, ask("hello")));
  });
  assert.equal(client.calls[0].model, "claude-haiku-5-5");
});

test("upstream failures become a friendly in-chat error, never a raw one", async () => {
  const client = fakeClient([new Error("socket hang up: secret internals")]);
  await withServer(createSproutHandler({ client, log: quiet }), async (base) => {
    const evs = await events(await post(base, ask("hello")));
    assert.deepEqual(evs, [{ type: "error", message: "Sprout couldn't answer just now. Please try again in a moment." }]);
  });
});

test("refusals end with a friendly redirect", async () => {
  const client = fakeClient([{ stop_reason: "refusal", content: [] }]);
  await withServer(createSproutHandler({ client, log: quiet }), async (base) => {
    const evs = await events(await post(base, ask("something odd")));
    assert.equal(evs[0].type, "error");
    assert.match(evs[0].message, /budget, debt, savings/);
  });
});

test("rejects long messages and enforces the rate limit", async () => {
  const client = fakeClient(Array.from({ length: 5 }, () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] })));
  const limiter = createRateLimiter({ perMinute: 2, perDay: 100 });
  await withServer(createSproutHandler({ client, limiter, log: quiet }), async (base) => {
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
  await withServer(createSproutHandler({ client: null, allowedOrigins: [PAGES], log: quiet }), async (base) => {
    const res = await fetch(`${base}/healthz`, { headers: { Origin: PAGES } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(res.headers.get("access-control-allow-origin"), PAGES);
  });
});

test("CORS: GitHub Pages is allowed, other sites are refused", async () => {
  await withServer(createSproutHandler({ client: okClient(), allowedOrigins: [PAGES], allowLocalhost: false, log: quiet }), async (base) => {
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
  await withServer(createSproutHandler({ client: okClient(), allowedOrigins: [PAGES], allowLocalhost: true, log: quiet }), async (base) => {
    const res = await fromOrigin(base, "http://localhost:3000");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:3000");
    await res.text();
  });
});

test("behind Render's proxy the rate limit keys on the visitor, not the proxy", async () => {
  const limiter = createRateLimiter({ perMinute: 1, perDay: 100 });
  await withServer(createSproutHandler({ client: okClient(), limiter, trustProxy: true, log: quiet }), async (base) => {
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
  await withServer(createSproutHandler({ client: okClient(), budget, log }), async (base) => {
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
  await withServer(createSproutHandler({ client: okClient(), budget, log }), async (base) => {
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
  await withServer(createSproutHandler({ client: okClient(), allowedOrigins: [PAGES], allowLocalhost: false, requireOrigin: true, log: quiet }), async (base) => {
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
