import "@testing-library/jest-dom";
import fs from "fs";
import path from "path";
import { useEffect } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextDecoder, TextEncoder } from "util";
import { SproutChat, SproutLauncher, SproutMascot, SproutProvider, SuggestedQuestions, useSprout } from "..";
import { SERVER_TIMEOUT_MS, checkSproutLive, resetSproutLiveCheck, streamSprout } from "../sproutClient";

const STARTERS = ["What's my debt-free date if I pay $200 more a month?"];

function renderSprout(extra = null, props = {}) {
  return render(
    <SproutProvider scope={`test-${Math.random()}`} getContext={() => ({})} {...props}>
      <SproutLauncher />
      <SproutChat starters={STARTERS} />
      {extra}
    </SproutProvider>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  resetSproutLiveCheck();
  delete global.fetch;
});

/** Fakes the Sprout server: /status says live, /chat streams the given SSE events (or fails). */
function fakeServer(chatEvents, { chatStatus = 200, chatDelay = null } = {}) {
  global.TextDecoder = global.TextDecoder ?? TextDecoder;
  const calls = [];
  global.fetch = jest.fn(async (url, init) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    if (url.endsWith("/healthz")) return { ok: true, json: async () => ({ ok: true }) };
    if (url.endsWith("/api/sprout/status")) return { ok: true, json: async () => ({ live: true }) };
    if (chatDelay) await chatDelay;
    if (chatStatus !== 200) return { ok: false, status: chatStatus, json: async () => ({ error: "Sprout is helping a lot of people right now. Please try again in a minute." }) };
    const chunks = chatEvents.map((ev) => new TextEncoder().encode(`data: ${JSON.stringify(ev)}\n\n`));
    return { ok: true, body: { getReader: () => ({ read: async () => (chunks.length ? { value: chunks.shift(), done: false } : { done: true }) }) } };
  });
  return calls;
}

test("launcher opens and closes the panel with correct ARIA state", async () => {
  renderSprout();
  const launcher = screen.getByRole("button", { name: /ask sprout/i });
  expect(launcher).toHaveAttribute("aria-expanded", "false");
  expect(launcher).toHaveAttribute("aria-controls", "sprout-panel");

  userEvent.click(launcher);
  const panel = screen.getByRole("dialog", { name: "Sprout" });
  expect(panel).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /close sprout, your ai money guide/i })).toHaveAttribute("aria-expanded", "true");
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Message Sprout" })).toHaveFocus());

  userEvent.click(within(panel).getByRole("button", { name: "Close Sprout" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Escape closes the panel and returns focus to the launcher", async () => {
  renderSprout();
  const launcher = screen.getByRole("button", { name: /ask sprout/i });
  userEvent.click(launcher);
  const input = await screen.findByRole("textbox", { name: "Message Sprout" });
  await waitFor(() => expect(input).toHaveFocus());
  userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(launcher).toHaveFocus();
});

test("panel always shows the AI-guide disclaimer", () => {
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  expect(screen.getByText("AI guide, not a licensed advisor.")).toBeVisible();
});

test("a suggested question streams a reply with the calculator it used", async () => {
  renderSprout(<SuggestedQuestions questions={STARTERS} label="Page chips" />);
  const pageChips = screen.getByRole("group", { name: "Page chips" });
  userEvent.click(within(pageChips).getByRole("button", { name: STARTERS[0] }));

  const log = await screen.findByRole("list", { name: "Conversation with Sprout" });
  expect(within(log).getByText(STARTERS[0])).toBeInTheDocument();
  expect(await within(log).findByText("Debt payoff calculator", {}, { timeout: 3000 })).toBeInTheDocument();
  await waitFor(() => expect(log).toHaveTextContent(/debt-free around/i), { timeout: 5000 });
  // While streaming the Stop button is offered; afterwards Send returns.
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument(), { timeout: 5000 });
});

test("Enter sends and Shift+Enter adds a new line", async () => {
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  const input = screen.getByRole("textbox", { name: "Message Sprout" });
  userEvent.type(input, "line one{shift}{enter}{/shift}line two");
  expect(input.value).toBe("line one\nline two");
  userEvent.type(input, "{enter}");
  expect(await screen.findByText(/line one/)).toBeInTheDocument();
  expect(input.value).toBe("");
});

test("messages over 1,000 characters are refused", async () => {
  let api;
  function Grab() {
    const ctx = useSprout();
    useEffect(() => {
      api = ctx;
    });
    return null;
  }
  renderSprout(<Grab />);
  let accepted;
  await act(async () => {
    accepted = await api.ask("x".repeat(1001));
  });
  expect(accepted).toBe(false);
  expect(screen.queryByRole("list", { name: "Conversation with Sprout" })).not.toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  expect(screen.getByRole("textbox", { name: "Message Sprout" })).toHaveAttribute("maxLength", "1000");
});

test("preview notice shows when there's no live server", async () => {
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  expect(await screen.findByText(/Preview mode: replies are scripted examples/)).toBeInTheDocument();
});

test("live mode: no preview notice, streams text and shows the calculator that actually ran", async () => {
  const calls = fakeServer([
    { type: "tool", name: "simulate_debt_payoff", label: "Debt payoff calculator", summary: "extra $300/mo · highest interest first" },
    { type: "text", text: "You'd be debt-free by " },
    { type: "text", text: "**Jun 2029**." },
    { type: "done" },
  ]);
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  const input = screen.getByRole("textbox", { name: "Message Sprout" });
  expect(input).toHaveAttribute("data-gramm", "false");
  expect(input).toHaveAttribute("data-enable-grammarly", "false");
  userEvent.type(input, "If I put $300 extra toward debt, when am I debt-free?{enter}");

  const log = await screen.findByRole("list", { name: "Conversation with Sprout" });
  await waitFor(() => expect(log).toHaveTextContent("You'd be debt-free by Jun 2029."));
  expect(within(log).getByText("Debt payoff calculator")).toBeInTheDocument();
  expect(within(log).getByText(/extra \$300\/mo/)).toBeInTheDocument();
  expect(screen.queryByText(/Preview mode/)).not.toBeInTheDocument();
  const chat = calls.find((c) => c.url.endsWith("/api/sprout/chat"));
  expect(chat.body.messages).toEqual([{ role: "user", content: "If I put $300 extra toward debt, when am I debt-free?" }]);
});

test("live mode: a failed request shows a friendly retry message, never a raw error", async () => {
  fakeServer([], { chatStatus: 503 });
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  userEvent.type(screen.getByRole("textbox", { name: "Message Sprout" }), "hello{enter}");
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Sprout is helping a lot of people right now.");
  expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
});

test("live mode: a reply cut off mid-stream ends with the retry message", async () => {
  fakeServer([{ type: "text", text: "Half a sen" }]);
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  userEvent.type(screen.getByRole("textbox", { name: "Message Sprout" }), "hello{enter}");
  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't answer just now/);
});

test("the reset button clears the conversation", async () => {
  fakeServer([{ type: "text", text: "Hi there!" }, { type: "done" }]);
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  userEvent.type(screen.getByRole("textbox", { name: "Message Sprout" }), "hello{enter}");
  await screen.findByText("Hi there!");
  userEvent.click(screen.getByRole("button", { name: "Start a new conversation" }));
  expect(screen.queryByRole("list", { name: "Conversation with Sprout" })).not.toBeInTheDocument();
  expect(screen.getByText("Hi, I'm Sprout!")).toBeInTheDocument();
});

test("opening the chat pings /healthz to wake the server", async () => {
  const calls = fakeServer([]);
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  await waitFor(() => expect(calls.some((c) => c.url.endsWith("/healthz"))).toBe(true));
});

test("a slow first reply shows 'Sprout is waking up…' instead of typing dots, then the answer", async () => {
  let wake;
  fakeServer([{ type: "text", text: "Good morning!" }, { type: "done" }], { chatDelay: new Promise((r) => (wake = r)) });
  renderSprout(null, { wakingAfterMs: 30 });
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  userEvent.type(screen.getByRole("textbox", { name: "Message Sprout" }), "hello{enter}");
  expect(await screen.findByText("Sprout is waking up…")).toBeInTheDocument();
  expect(screen.queryByLabelText("Sprout is thinking")).not.toBeInTheDocument();
  await act(async () => wake());
  expect(await screen.findByText("Good morning!")).toBeInTheDocument();
  expect(screen.queryByText("Sprout is waking up…")).not.toBeInTheDocument();
});

test("the first request waits at least 90 seconds, then gives a friendly timeout", async () => {
  expect(SERVER_TIMEOUT_MS).toBeGreaterThanOrEqual(90_000);
  // A server that never answers (but respects abort, like real fetch).
  global.fetch = jest.fn((url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
  const events = [];
  await streamSprout({ live: true, messages: [], onEvent: (e) => events.push(e), timeoutMs: 20 });
  expect(events).toEqual([{ type: "error", message: "Sprout took too long to wake up. Please try again in a moment." }]);
});

test.each([
  ["the network fails", () => Promise.reject(new TypeError("Failed to fetch"))],
  ["the API URL returns 404 (GitHub Pages)", () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) })],
  ["the server has no key", () => Promise.resolve({ ok: true, json: async () => ({ live: false }) })],
])("preview mode kicks in automatically when %s", async (_, respond) => {
  global.fetch = jest.fn(respond);
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  expect(await screen.findByText(/Preview mode: replies are scripted examples/)).toBeInTheDocument();
  userEvent.type(screen.getByRole("textbox", { name: "Message Sprout" }), "hello{enter}");
  const log = await screen.findByRole("list", { name: "Conversation with Sprout" });
  await waitFor(() => expect(log).toHaveTextContent(/quick picture/), { timeout: 4000 });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("a server that never answers the status check counts as unavailable", async () => {
  global.fetch = jest.fn((url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
  await expect(checkSproutLive(20)).resolves.toBe(false);
});

test("mascot is decorative unless given a label", () => {
  const { container } = render(
    <>
      <SproutMascot variant="full" />
      <SproutMascot variant="head" label="Sprout waving hello" mood="wave" />
    </>
  );
  expect(container.querySelector(".sp-mascot--full")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByRole("img", { name: "Sprout waving hello" })).toHaveClass("sp-mascot--head", "sp-mascot--wave");
});

test("all Sprout animations are switched off for reduced motion", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "sprout.css"), "utf8");
  const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  expect(block).toMatch(/\.sp-mascot \*/);
  expect(block).toMatch(/animation: none !important/);
  expect(block).toMatch(/\.sp-panel/);
});

test("no browser code references the Anthropic API key", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(js|jsx|ts|tsx)$/.test(f.name) && !p.includes("__tests__")) {
        if (/ANTHROPIC|REACT_APP_ANTHROPIC|sk-ant-/.test(fs.readFileSync(p, "utf8"))) offenders.push(p);
      }
    }
  };
  walk(path.join(__dirname, "..", ".."));
  expect(offenders).toEqual([]);
});
