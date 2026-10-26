// Sprout's calculator tools. The server runs these when the model asks for a number; the model never does the math itself.
// Pure and React-free so Jest tests them and the Node server can import them. Imports keep their ".js" for Node.

import {
  EMERGENCY_TARGET_MONTHS,
  addMonths,
  computeMetrics,
  goalStatus,
  gradeBreakdown,
  monteCarlo,
  simulatePayoff,
  trimSpending,
} from "../dashboard/finance.js";
import { debtFreeSummary } from "../dashboard/summaries.js";
import { money, pct } from "../design/format.js";

const STRATEGY_TEXT = { avalanche: "highest interest first", snowball: "smallest balance first" };
const MAX_ITEMS = 20;

// ---------- Reading the plan the browser sent ----------

const finite = (v, lo, hi, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const text = (v, max = 60) => (typeof v === "string" ? v.slice(0, max) : "");
const list = (v) => (Array.isArray(v) ? v.slice(0, MAX_ITEMS) : []);
const BIG = 1e9;

/**
 * Rebuilds the profile and plan from untrusted JSON, keeping only the fields the calculators use and clamping every number.
 * Returns { profile: null } when the user hasn't finished the survey.
 */
export function readContext(context) {
  const c = context && typeof context === "object" ? context : {};
  const p = c.profile && typeof c.profile === "object" ? c.profile : null;
  const rawPlan = c.plan && typeof c.plan === "object" ? c.plan : {};
  const plan = {
    extraDebt: finite(rawPlan.extraDebt, 0, 100000, 0),
    strategy: rawPlan.strategy === "snowball" ? "snowball" : "avalanche",
    trim: finite(rawPlan.trim, 0, 1, 0),
    monthlyInvest: finite(rawPlan.monthlyInvest, 0, 100000, 0),
    investYears: Math.round(finite(rawPlan.investYears, 1, 60, 30)),
    stockShare: finite(rawPlan.stockShare, 0, 1, 0.8),
    retireAge: Math.round(finite(rawPlan.retireAge, 18, 100, 60)),
  };
  if (!p) return { profile: null, plan, demo: Boolean(c.demo) };

  const r = p.retirement && typeof p.retirement === "object" ? p.retirement : {};
  const profile = {
    age: Math.round(finite(p.age, 14, 100, 30)),
    ageAssumed: Boolean(p.ageAssumed),
    retirementAge: Math.round(finite(p.retirementAge, 18, 100, 60)),
    income: list(p.income).map((i) => ({ name: text(i?.name), monthly: finite(i?.monthly, 0, BIG) })),
    expenses: list(p.expenses).map((e) => ({
      key: text(e?.key, 30),
      name: text(e?.name),
      monthly: finite(e?.monthly, 0, BIG),
      essential: Boolean(e?.essential),
      discretionary: finite(e?.discretionary, 0, 1),
    })),
    debts: list(p.debts).map((d) => ({
      name: text(d?.name) || "Debt",
      balance: finite(d?.balance, 0, BIG),
      apr: finite(d?.apr, 0, 1),
      minPayment: finite(d?.minPayment, 0, BIG),
    })),
    accounts: list(p.accounts).map((a) => ({
      name: text(a?.name),
      kind: a?.kind === "invest" ? "invest" : "cash",
      balance: finite(a?.balance, 0, BIG),
      emergency: Boolean(a?.emergency),
    })),
    otherAssets: list(p.otherAssets).map((a) => ({ name: text(a?.name), value: finite(a?.value, 0, BIG) })),
    retirement: {
      salaryAnnual: finite(r.salaryAnnual, 0, BIG),
      contributionRate: finite(r.contributionRate, 0, 1),
      matchUpTo: finite(r.matchUpTo, 0, 1),
      unknown: Boolean(r.unknown),
    },
    allocation: list(p.allocation).map((a) => ({ key: text(a?.key, 30), name: text(a?.name), monthly: finite(a?.monthly, 0, BIG) })),
    allocationSuggested: Boolean(p.allocationSuggested),
    goals: list(p.goals).map((g) => ({
      key: text(g?.key, 30),
      name: text(g?.name),
      target: g?.target == null ? null : finite(g.target, 0, BIG),
      targetDate: /^\d{4}-\d{2}$/.test(g?.targetDate) ? g.targetDate : null,
      account: text(g?.account),
    })),
  };
  return { profile, plan, demo: Boolean(c.demo) };
}

// ---------- The snapshot that goes in the system prompt ----------

/** Plain facts from the survey (no computed results), so the model knows what the user has without doing math. */
export function planSnapshot({ profile, plan, demo }, now = new Date()) {
  const today = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  if (!profile) return `Today is ${today}.\nThe user has NOT completed the survey yet, so there is no plan. The calculator tools will say so.`;
  const lines = [`Today is ${today}.`];
  if (demo) lines.push("These are SAMPLE numbers on the public demo, not the visitor's own. Say so if it matters.");
  lines.push(`Age: ${profile.age}${profile.ageAssumed ? " (assumed; the user left it blank)" : ""}`);
  lines.push(`Monthly income: ${profile.income.map((i) => `${i.name} ${money(i.monthly)}`).join("; ") || "none entered"}`);
  lines.push(
    `Monthly spending: ${profile.expenses.map((e) => `${e.name} ${money(e.monthly)}${e.essential ? " (essential)" : ""}`).join("; ") || "none entered"}`
  );
  lines.push(
    `Debts: ${
      profile.debts.map((d) => `${d.name}: balance ${money(d.balance)}, ${pct(d.apr, 1)} APR, minimum ${money(d.minPayment)}/mo`).join("; ") || "none"
    }`
  );
  lines.push(`Accounts: ${profile.accounts.map((a) => `${a.name} ${money(a.balance)}${a.emergency ? " (emergency fund)" : ""}`).join("; ") || "none"}`);
  const r = profile.retirement;
  lines.push(
    r.unknown
      ? "401(k): the survey hasn't asked about contributions or an employer match yet (unknown)."
      : `401(k): contributes ${pct(r.contributionRate)} of a ${money(r.salaryAnnual)} salary; employer matches up to ${pct(r.matchUpTo)}.`
  );
  if (profile.allocation.length) {
    lines.push(
      `${profile.allocationSuggested ? "Suggested split" : "How they split what's left over"}: ${profile.allocation.map((a) => `${a.name} ${money(a.monthly)}`).join("; ")}`
    );
  }
  const goals = profile.goals.filter((g) => g.target);
  if (goals.length) lines.push(`Goals: ${goals.map((g) => `${g.name} ${money(g.target)}${g.targetDate ? ` by ${g.targetDate}` : ""}`).join("; ")}`);
  lines.push(
    `Their saved what-if settings on the dashboard: extra debt payment ${money(plan.extraDebt)}/mo (${STRATEGY_TEXT[plan.strategy]}), investing ${money(plan.monthlyInvest)}/mo, ${pct(plan.stockShare)} stocks, retire at ${plan.retireAge}.`
  );
  return lines.join("\n");
}

// ---------- Tool definitions (Claude's format; server/llm/gemini.mjs converts them. Keep the order stable so the prompt cache holds) ----------

const obj = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });

export const TOOL_DEFS = [
  {
    name: "get_plan_summary",
    description:
      "The user's overall picture: monthly income, spending, minimum debt payments, money left over, savings rate, net worth, total debt, emergency-fund months, house goal and the financial grade. Use for general 'how am I doing' questions.",
    input_schema: obj({}),
  },
  {
    name: "simulate_debt_payoff",
    description:
      "Month-by-month payoff of all the user's debts with an extra monthly payment on top of the minimums (each paid-off debt's minimum rolls into the next). Returns the debt-free date, interest paid and the order debts are cleared, compared with paying only the minimums. Use for any question about debt-free dates, extra payments or avalanche vs snowball.",
    input_schema: obj(
      {
        extra_monthly_payment: { type: "number", description: "Extra dollars a month on top of the minimums. Use the user's saved plan amount if they didn't name one." },
        strategy: { type: "string", enum: ["avalanche", "snowball"], description: "avalanche = highest interest first, snowball = smallest balance first." },
      },
      ["extra_monthly_payment", "strategy"]
    ),
  },
  {
    name: "project_investments",
    description:
      "Runs 500 simulated market futures for the user's investments (in today's dollars) until retirement. Returns cautious / middle / hopeful outcomes and the chance of reaching their financial-independence number. Use for questions about investing, retirement or 'will I have enough'.",
    input_schema: obj(
      {
        monthly_contribution: { type: "number", description: "Dollars invested each month. Use the saved plan amount if not given." },
        stock_share: { type: "number", description: "Share in stocks from 0 to 1 (rest in bonds). Use the saved plan if not given." },
        retire_age: { type: "integer", description: "Age the projection runs to. Use the saved plan if not given." },
      },
      []
    ),
  },
  {
    name: "emergency_fund_status",
    description:
      "How many months of essential costs the user's emergency savings cover, the 6-month target, and how long until they reach it at their current monthly saving.",
    input_schema: obj({}),
  },
  {
    name: "budget_breakdown",
    description:
      "Monthly spending by category, which parts are essential vs flexible, and optionally what trimming flexible spending by a percentage would free up (and grow to in 10 years).",
    input_schema: obj({ trim_flexible_percent: { type: "number", description: "Optional: percent (0-100) to trim from flexible spending." } }),
  },
  {
    name: "retirement_match",
    description:
      "The user's 401(k) contribution vs their employer match: what they put in, what the match is worth, and any free match money they are missing each year.",
    input_schema: obj({}),
  },
].map((t) => ({ ...t, eager_input_streaming: true }));

// ---------- Running a tool ----------

const NEVER = 600; // simulatePayoff gives up here: the debt isn't paid off at this pace
const NO_PLAN = {
  error: "no_plan",
  message: "The user hasn't completed the survey yet, so there are no numbers to calculate with. Invite them to plant their first seed (take the survey).",
};

const round = (v) => Math.round(v);

function planSummary(profile, m, now) {
  const grade = gradeBreakdown(m);
  const { house } = goalStatus(profile, m, now);
  return {
    monthly_income: money(m.income),
    monthly_spending: money(m.expenses),
    monthly_minimum_debt_payments: money(m.minDebt),
    left_over_each_month: money(m.surplus),
    left_over_formula: `${money(m.income)} income - ${money(m.expenses)} spending - ${money(m.minDebt)} minimum debt payments`,
    savings_rate: pct(m.savingsRate),
    total_debt: money(m.totalDebt),
    high_interest_debt_8pct_plus: money(m.highInterestDebt),
    cash: money(m.cash),
    invested: money(m.invested),
    net_worth: money(m.netWorth),
    emergency_fund_months: Number(m.emergencyMonths.toFixed(1)),
    financial_grade: { letter: grade.letter, score: round(grade.score), parts: grade.parts.map((p) => `${p.label}: ${round(p.score)}/100`) },
    house_goal: house
      ? {
          name: house.name,
          saved: money(house.current),
          target: money(house.target),
          saving_per_month: money(house.monthly),
          reach_date: Number.isFinite(house.monthsLeft) ? addMonths(now, house.monthsLeft) : "not at this pace",
          on_track_for_deadline: house.onTrack,
          needed_per_month_for_deadline: money(house.neededMonthly),
        }
      : null,
  };
}

function debtPayoff(profile, input, now) {
  const extra = finite(input.extra_monthly_payment, 0, 100000, 0);
  const strategy = input.strategy === "snowball" ? "snowball" : "avalanche";
  const s = debtFreeSummary(profile.debts, { extra, strategy, now });
  if (!s.hasDebt) return { has_debt: false, message: s.sentence };
  // Same calculation as the Debt page's "Debt-free by" tile and its payoff-order list.
  const owed = profile.debts.filter((d) => d.balance > 0);
  const order = simulatePayoff(owed, { extra, strategy }).payoffOrder.map((d) => ({
    name: d.name,
    apr: pct(d.apr, 1),
    paid_off: d.month == null ? "not at this pace" : addMonths(now, d.month),
  }));
  return {
    has_debt: true,
    extra_monthly_payment: money(extra),
    strategy: STRATEGY_TEXT[strategy],
    debt_free_date: s.plan.date ?? "never at this pace",
    months_to_debt_free: s.plan.months >= NEVER ? null : s.plan.months,
    total_interest_paid: money(s.plan.interest),
    minimums_only: {
      debt_free_date: s.base.date ?? "never at this pace",
      months: s.base.months >= NEVER ? null : s.base.months,
      total_interest_paid: money(s.base.interest),
    },
    months_sooner_than_minimums: s.monthsSooner,
    interest_saved_vs_minimums: money(s.interestSaved),
    payoff_order: order,
    assumptions: "Balances and APRs from the survey, interest charged monthly, every minimum paid plus the extra, each paid-off debt's minimum moves to the next debt.",
  };
}

function investments(profile, m, plan, input) {
  const monthly = finite(input.monthly_contribution, 0, 100000, plan.monthlyInvest);
  const stockShare = finite(input.stock_share, 0, 1, plan.stockShare);
  const retireAge = Math.round(finite(input.retire_age, profile.age + 1, 100, plan.retireAge));
  const years = Math.max(1, retireAge - profile.age);
  // Same inputs as the Future page.
  const sim = monteCarlo({ start: m.invested, monthly, stockShare, years, goal: m.fiNumber });
  const at = (band) => money(sim.bands[band][years]);
  return {
    inputs: { starting_balance: money(m.invested), monthly_contribution: money(monthly), stock_share: pct(stockShare), years, retire_age: retireAge },
    outcome_at_retirement_todays_dollars: { cautious_10th_percentile: at("p10"), middle_50th_percentile: at("p50"), hopeful_90th_percentile: at("p90") },
    financial_independence_number: money(m.fiNumber),
    fi_number_formula: `25 x yearly spending (${money(m.expenses * 12)}), the "4% rule"`,
    chance_of_reaching_fi_number: pct(sim.successRate),
    assumed_average_return_after_inflation: pct(sim.expectedReturn, 1),
    note: "500 simulated futures; markets can do better or worse than any of these.",
  };
}

function emergencyFund(profile, m, now) {
  const { emergency } = goalStatus(profile, m, now);
  return {
    saved: money(m.emergencyBalance),
    essential_costs_per_month: money(m.essential),
    essential_formula: "essential spending + minimum debt payments",
    months_covered: Number(m.emergencyMonths.toFixed(1)),
    target_months: EMERGENCY_TARGET_MONTHS,
    target_amount: money(m.emergencyTarget),
    still_needed: money(Math.max(0, m.emergencyTarget - m.emergencyBalance)),
    saving_per_month: money(emergency.monthly),
    target_reached_by:
      emergency.monthsLeft === 0 ? "already reached" : Number.isFinite(emergency.monthsLeft) ? addMonths(now, emergency.monthsLeft) : "no monthly saving set",
    months_to_target: Number.isFinite(emergency.monthsLeft) ? emergency.monthsLeft : null,
  };
}

function budget(profile, m, input) {
  const out = {
    monthly_income: money(m.income),
    categories: profile.expenses.map((e) => ({
      name: e.name,
      monthly: money(e.monthly),
      share_of_income: pct(m.income ? e.monthly / m.income : 0),
      essential: e.essential,
      flexible_part: money(e.monthly * (e.discretionary ?? 0)),
    })),
    total_spending: money(m.expenses),
    minimum_debt_payments: money(m.minDebt),
    left_over: money(m.surplus),
    flexible_spending_total: money(m.discretionary),
    housing_share_of_income: pct(m.housingRatio),
  };
  if (input.trim_flexible_percent != null) {
    const trim = finite(input.trim_flexible_percent, 0, 100, 0) / 100;
    const t = trimSpending(profile, m, trim);
    out.what_if_trim = {
      trim_flexible_by: pct(trim),
      freed_each_month: money(t.saved),
      new_left_over: money(t.surplus),
      new_savings_rate: pct(t.savingsRate),
      freed_money_invested_for_10_years: money(t.tenYearValue),
      growth_assumption: "5.5% a year after inflation",
    };
  }
  return out;
}

function match(profile, m) {
  const r = profile.retirement;
  if (r.unknown) {
    return {
      known: false,
      message: "The survey doesn't ask about 401(k) contributions or an employer match yet, so there are no numbers. Explain the idea generally and suggest checking their HR or benefits portal.",
    };
  }
  return {
    known: true,
    salary: money(r.salaryAnnual),
    you_contribute: `${pct(r.contributionRate)} = ${money(r.contributionRate * r.salaryAnnual)} a year`,
    employer_matches_up_to: `${pct(r.matchUpTo)} = ${money(r.matchUpTo * r.salaryAnnual)} a year`,
    free_match_missed_per_year: money(m.matchMissedAnnual),
    to_get_full_match_contribute: pct(Math.max(r.contributionRate, r.matchUpTo)),
    getting_full_match: r.contributionRate >= r.matchUpTo,
  };
}

/** Runs one tool. Returns a plain object (sent back to the model as JSON). Never throws for bad input. */
export function runTool(name, input, ctx, now = new Date()) {
  const args = input && typeof input === "object" ? input : {};
  const { profile, plan } = ctx;
  if (!TOOL_DEFS.some((t) => t.name === name)) return { error: "unknown_tool", message: `No tool named ${name}.` };
  if (!profile) return NO_PLAN;
  const m = computeMetrics(profile);
  switch (name) {
    case "get_plan_summary":
      return planSummary(profile, m, now);
    case "simulate_debt_payoff":
      return debtPayoff(profile, args, now);
    case "project_investments":
      return investments(profile, m, plan, args);
    case "emergency_fund_status":
      return emergencyFund(profile, m, now);
    case "budget_breakdown":
      return budget(profile, m, args);
    default:
      return match(profile, m);
  }
}

/** The label shown on the chat's "calculations Sprout ran" pill, with the inputs it used. */
export function toolPill(name, input, ctx) {
  const a = input && typeof input === "object" ? input : {};
  const plan = ctx.plan;
  switch (name) {
    case "get_plan_summary":
      return { label: "Plan summary", summary: "income, spending, savings, debts" };
    case "simulate_debt_payoff":
      return {
        label: "Debt payoff calculator",
        summary: `extra ${money(finite(a.extra_monthly_payment, 0, 100000, 0))}/mo · ${STRATEGY_TEXT[a.strategy === "snowball" ? "snowball" : "avalanche"]}`,
      };
    case "project_investments":
      return {
        label: "Investment projection",
        summary: `${money(finite(a.monthly_contribution, 0, 100000, plan.monthlyInvest))}/mo · ${pct(finite(a.stock_share, 0, 1, plan.stockShare))} stocks · to age ${Math.round(finite(a.retire_age, 18, 100, plan.retireAge))}`,
      };
    case "emergency_fund_status":
      return { label: "Emergency fund", summary: "savings vs 6 months of essentials" };
    case "budget_breakdown":
      return {
        label: "Budget breakdown",
        summary: a.trim_flexible_percent != null ? `trim flexible spending ${Math.round(finite(a.trim_flexible_percent, 0, 100))}%` : "spending by category",
      };
    case "retirement_match":
      return { label: "401(k) match", summary: "your contribution vs employer match" };
    default:
      return { label: "Calculator", summary: "" };
  }
}
