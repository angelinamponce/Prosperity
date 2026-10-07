// Scripted replies used while the real API route is being built (step 1).
// Emits the same events as the server: text, tool, done.

const SCRIPTS = [
  {
    match: /payoff|debt[- ]free|pay off|debt/i,
    tools: [{ name: "simulate_debt_payoff", label: "Debt payoff calculator", summary: "extra $200/mo · highest interest first" }],
    text:
      "With an extra **$200 a month**, paying your highest-interest debt first, you'd be debt-free around **Dec 2029**.\n\n" +
      "That's about 3 years sooner than paying only the minimums. Want to see what a different amount would do?",
  },
  {
    match: /401|match/i,
    tools: [{ name: "employer_match_value", label: "401(k) match", summary: "you 3% · employer up to 5%" }],
    text:
      "Your employer matches up to **5%** of your salary, and you're putting in **3%**. Raising it to 5% would add about **$1,560 a year** from your employer.\n\n" +
      "Whether that fits your budget is your call. A licensed advisor can help you weigh it against your other goals.",
  },
  {
    match: /stock|tesla|crypto|buy|fund/i,
    tools: [],
    text:
      "I can't recommend specific stocks or funds. I'm an AI guide, not a licensed advisor.\n\n" +
      "What I can do is show how different mixes of stocks and bonds have tended to grow, using your own numbers. Want to try that?",
  },
];

const FALLBACK = {
  tools: [{ name: "get_plan_summary", label: "Plan summary", summary: "income, spending, savings, debts" }],
  text:
    "Here's the quick picture: you bring in about **$6,250 a month** and have about **$2,200** left after bills and minimum payments.\n\n" +
    "Ask me about your debt payoff, your emergency fund or your 401(k), and I'll run the numbers.",
};

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

export async function mockStream({ messages, onEvent, signal }) {
  const question = messages[messages.length - 1]?.content ?? "";
  const script = SCRIPTS.find((s) => s.match.test(question)) ?? FALLBACK;
  await wait(500, signal);
  for (const tool of script.tools) {
    onEvent({ type: "tool", ...tool });
    await wait(350, signal);
  }
  // Stream a few words at a time, like the real API.
  const words = script.text.split(/(\s+)/);
  for (let i = 0; i < words.length; i += 4) {
    onEvent({ type: "text", text: words.slice(i, i + 4).join("") });
    await wait(40, signal);
  }
  onEvent({ type: "done" });
}
