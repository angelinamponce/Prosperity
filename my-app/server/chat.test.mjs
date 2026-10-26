// Run with `npm run test:server`. Uses a fake Claude client, so no API key or network is needed.
import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import { cleanMessages, createSproutHandler } from "./chat.mjs";
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
