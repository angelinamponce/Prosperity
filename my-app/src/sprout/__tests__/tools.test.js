import { addMonths, computeMetrics, monteCarlo, simulatePayoff } from "../../dashboard/finance";
import { sampleProfile } from "../../dashboard/sampleProfile";
import { profileFromRows } from "../../dashboard/profileFromRows";
import { money } from "../../design/format";
import { TOOL_DEFS, planSnapshot, readContext, runTool, toolPill } from "../tools";

const NOW = new Date(2026, 9, 26); // Oct 2026
const PLAN = { extraDebt: 300, strategy: "avalanche", trim: 0, monthlyInvest: 800, investYears: 30, stockShare: 0.8, retireAge: 60 };
const ctx = readContext({ profile: sampleProfile, plan: PLAN });
const run = (name, input = {}) => runTool(name, input, ctx, NOW);

test("every tool has a name, description and a closed object schema", () => {
  expect(TOOL_DEFS.map((t) => t.name)).toEqual([
    "get_plan_summary",
    "simulate_debt_payoff",
    "project_investments",
    "emergency_fund_status",
    "budget_breakdown",
    "retirement_match",
  ]);
  for (const t of TOOL_DEFS) {
    expect(t.description.length).toBeGreaterThan(40);
    expect(t.input_schema).toMatchObject({ type: "object", additionalProperties: false });
  }
});

test("readContext keeps the numbers the calculators need and clamps junk", () => {
  expect(computeMetrics(ctx.profile)).toEqual(computeMetrics(sampleProfile));
  const bad = readContext({
    profile: { debts: [{ name: "x".repeat(500), balance: "lots", apr: 9, minPayment: -5 }], income: "no" },
    plan: { strategy: "yolo", extraDebt: -1, stockShare: 7 },
  });
  expect(bad.profile.debts[0]).toEqual({ name: "x".repeat(60), balance: 0, apr: 1, minPayment: 0 });
  expect(bad.profile.income).toEqual([]);
  expect(bad.plan).toMatchObject({ strategy: "avalanche", extraDebt: 0, stockShare: 1 });
  expect(readContext(null).profile).toBeNull();
});

test("debt payoff matches the Debt page's date for the same extra payment", () => {
  const out = run("simulate_debt_payoff", { extra_monthly_payment: 300, strategy: "avalanche" });
  const planned = simulatePayoff(sampleProfile.debts, { extra: 300, strategy: "avalanche" });
  const base = simulatePayoff(sampleProfile.debts, { extra: 0, rollover: false });
  expect(out.debt_free_date).toBe(addMonths(NOW, planned.months));
  expect(out.months_to_debt_free).toBe(planned.months);
  expect(out.total_interest_paid).toBe(money(planned.interest));
  expect(out.minimums_only.debt_free_date).toBe(addMonths(NOW, base.months));
  expect(out.interest_saved_vs_minimums).toBe(money(base.interest - planned.interest));
  // Avalanche clears the 22.9% credit card first.
  expect(out.payoff_order[0]).toMatchObject({ name: "Credit card", apr: "22.9%" });
});

test("snowball and more extra change the answer in the expected direction", () => {
  const a = run("simulate_debt_payoff", { extra_monthly_payment: 300, strategy: "avalanche" });
  const more = run("simulate_debt_payoff", { extra_monthly_payment: 600, strategy: "avalanche" });
  const snow = run("simulate_debt_payoff", { extra_monthly_payment: 300, strategy: "snowball" });
  expect(more.months_to_debt_free).toBeLessThan(a.months_to_debt_free);
  expect(snow.strategy).toBe("smallest balance first");
  expect(snow.payoff_order[0].name).toBe("Credit card"); // also the smallest balance
});

test("debt payoff with no debts says so", () => {
  const none = readContext({ profile: { ...sampleProfile, debts: [] }, plan: PLAN });
  expect(runTool("simulate_debt_payoff", { extra_monthly_payment: 100, strategy: "avalanche" }, none, NOW)).toMatchObject({ has_debt: false });
});

test("plan summary reports the same leftover as the dashboard", () => {
  const m = computeMetrics(sampleProfile);
  const out = run("get_plan_summary");
  expect(out.left_over_each_month).toBe(money(m.surplus));
  expect(out.monthly_income).toBe("$6,250");
  expect(out.financial_grade.letter).toMatch(/^[A-F][+-]?$/);
  expect(out.house_goal).toMatchObject({ name: "House down payment", target: "$60,000" });
});

test("investment projection uses the Future page's inputs and returns a range", () => {
  const m = computeMetrics(sampleProfile);
  const out = run("project_investments", {});
  const sim = monteCarlo({ start: m.invested, monthly: 800, stockShare: 0.8, years: 34, goal: m.fiNumber });
  expect(out.inputs).toMatchObject({ monthly_contribution: "$800", stock_share: "80%", years: 34, retire_age: 60 });
  expect(out.outcome_at_retirement_todays_dollars.middle_50th_percentile).toBe(money(sim.bands.p50[34]));
  const n = (s) => Number(s.replace(/[$,]/g, ""));
  const o = out.outcome_at_retirement_todays_dollars;
  expect(n(o.cautious_10th_percentile)).toBeLessThan(n(o.middle_50th_percentile));
  expect(n(o.middle_50th_percentile)).toBeLessThan(n(o.hopeful_90th_percentile));
});

test("emergency fund status matches the Goals page numbers", () => {
  const out = run("emergency_fund_status");
  expect(out).toMatchObject({ saved: "$12,000", months_covered: 3.4, target_months: 6 });
  expect(out.target_reached_by).toBe(addMonths(NOW, out.months_to_target));
});

test("budget breakdown lists categories and the trim what-if", () => {
  const out = run("budget_breakdown", { trim_flexible_percent: 10 });
  expect(out.categories).toHaveLength(sampleProfile.expenses.length);
  expect(out.what_if_trim.trim_flexible_by).toBe("10%");
  expect(run("budget_breakdown").what_if_trim).toBeUndefined();
});

test("401(k) match: missed money for the sample, unknown for survey users", () => {
  expect(run("retirement_match")).toMatchObject({ known: true, free_match_missed_per_year: "$1,560", getting_full_match: false });
  const survey = profileFromRows({ user: { name: "A" }, income: { annual_income: 50000 }, savings: {}, spending: {} });
  expect(runTool("retirement_match", {}, readContext({ profile: survey, plan: PLAN }), NOW)).toMatchObject({ known: false });
});

test("no survey yet: every tool explains there is no plan", () => {
  const empty = readContext({ profile: null, plan: PLAN });
  for (const t of TOOL_DEFS) expect(runTool(t.name, {}, empty, NOW)).toMatchObject({ error: "no_plan" });
  expect(planSnapshot(empty, NOW)).toMatch(/NOT completed the survey/);
});

test("unknown tools and garbage input never throw", () => {
  expect(run("buy_stocks")).toMatchObject({ error: "unknown_tool" });
  expect(() => run("simulate_debt_payoff", { extra_monthly_payment: "abc", strategy: 4 })).not.toThrow();
  expect(() => runTool("project_investments", null, ctx, NOW)).not.toThrow();
});

test("snapshot lists debts with APRs and minimums, and pills show the real inputs", () => {
  const snap = planSnapshot(ctx, NOW);
  expect(snap).toMatch(/Credit card: balance \$3,200, 22\.9% APR, minimum \$95\/mo/);
  expect(snap).toMatch(/Today is October 2026/);
  expect(toolPill("simulate_debt_payoff", { extra_monthly_payment: 300, strategy: "snowball" }, ctx)).toEqual({
    label: "Debt payoff calculator",
    summary: "extra $300/mo · smallest balance first",
  });
  expect(toolPill("project_investments", {}, ctx).summary).toBe("$800/mo · 80% stocks · to age 60");
});
