// The garden, derived from the player's real numbers and what they've learned. Nothing about the garden
// is stored: it's recomputed from data every time, so it can never drift from the plan or invent progress.
// Every element carries its exact figure and how it was worked out, for "Show the numbers".
// Shared by the dashboard preview now and Garden mode later.

import { HIGH_INTEREST_APR, addMonths, simulatePayoff } from "../dashboard/finance";
import { debtFreeSummary } from "../dashboard/summaries";
import { money, pct } from "../design/format";

export const DEBT_PER_WEED = 2500;
export const MAX_WEEDS_PER_DEBT = 6;
// How far ahead the garden looks when it outlines the patches a plan would clear.
export const LOOKAHEAD_MONTHS = 12;
const NEVER = 600; // the payoff simulation's cap: past this, minimums never catch up

const patchCount = (balance) => Math.min(MAX_WEEDS_PER_DEBT, Math.ceil(balance / DEBT_PER_WEED));

/**
 * When a payment plan clears each debt, and each of its weed patches. A debt's patches each stand for an
 * equal share of today's balance; a patch counts as cleared in the first month the balance drops below
 * its share, so the patches planted last go first and the first one goes when the debt is paid off.
 * Plain projections: they assume balances, rates and minimums stay as they are today.
 * Returns { debts: [{ name, payoffMonth, payoffDate, patchMonths }], months, date } with months null when
 * the plan never clears the debt.
 */
export function payoffLookahead(allDebts, { extra = 0, strategy = "avalanche", now = new Date() } = {}) {
  const debts = allDebts.filter((d) => d.balance > 0);
  if (!debts.length) return { debts: [], months: 0, date: null };
  const run = simulatePayoff(debts, { extra, strategy });
  const firstBelow = (hist, limit) => {
    const m = hist.findIndex((b) => b <= limit + 0.01);
    return m > 0 && m < NEVER ? m : null;
  };
  const out = debts.map((d, i) => {
    const n = patchCount(d.balance);
    const hist = run.histories[i];
    const patchMonths = Array.from({ length: n }, (_, k) => firstBelow(hist, (d.balance * k) / n));
    const payoffMonth = patchMonths[0];
    return { name: d.name, payoffMonth, payoffDate: payoffMonth != null ? addMonths(now, payoffMonth) : null, patchMonths };
  });
  const months = run.months < NEVER ? run.months : null;
  return { debts: out, months, date: months != null ? addMonths(now, months) : null };
}

// Soil richness from the savings rate. Even the lowest tier is "resting", never dead.
const SOIL = [
  { key: "resting", label: "Resting soil", below: 0.0001 },
  { key: "good", label: "Good soil", below: 0.1 },
  { key: "rich", label: "Rich soil", below: 0.2 },
  { key: "lush", label: "Lush soil", below: Infinity },
];

// The emergency-fund greenhouse grows at 1, 3 and 6 months of essentials.
const GREENHOUSE = ["Just a plot", "Frame going up", "Walls up", "Roof on", "Finished greenhouse"];
const greenhouseStage = (months) => (months <= 0 ? 0 : months < 1 ? 1 : months < 3 ? 2 : months < 6 ? 3 : 4);

// Visitors arrive as the health score grows. None of them ever leave for good.
const VISITORS = [
  { at: 40, name: "butterflies" },
  { at: 60, name: "bees" },
  { at: 80, name: "a bird" },
];

const listJoin = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * profile, m (computeMetrics), plan ({ extraDebt, strategy }), healthScore (0 to 100),
 * learned / wordTotal (money words learned, out of how many).
 */
export function deriveGarden({ profile, m, plan, healthScore, learned = 0, wordTotal = 0, now = new Date() }) {
  // Soil
  const soil = SOIL.find((s) => m.savingsRate < s.below);
  const soilEl = {
    id: "soil",
    name: "Soil",
    state: soil.key,
    label: soil.label,
    value: pct(m.savingsRate, 1),
    title: "Savings rate",
    calc: `${money(m.surplus)} kept ÷ ${money(m.income)} income = ${pct(m.savingsRate, 1)}. Good soil starts above 0%, rich at 10%, lush at 20%.`,
  };

  // Greenhouse
  const stage = greenhouseStage(m.emergencyMonths);
  const greenhouseEl = {
    id: "greenhouse",
    name: "Greenhouse",
    state: stage,
    label: GREENHOUSE[stage],
    value: `${m.emergencyMonths.toFixed(1)} months`,
    title: "Emergency cushion",
    calc:
      m.essential > 0
        ? `${money(m.emergencyBalance)} saved ÷ ${money(m.essential)} of essentials a month = ${m.emergencyMonths.toFixed(1)} months. It grows a stage at 1, 3 and 6 months.`
        : "No essential costs recorded yet, so the greenhouse is waiting for your survey numbers.",
  };

  // Weeds: one patch per $2,500 owed on each debt; high-interest debts grow thorny brambles.
  const debts = profile.debts.filter((d) => d.balance > 0);
  // When each debt is paid off on the saved plan (null if minimums never catch up).
  const ahead = payoffLookahead(profile.debts, { extra: plan.extraDebt, strategy: plan.strategy, now });
  const weeds = debts.map((d, i) => ({
    name: d.name,
    patches: patchCount(d.balance),
    thorny: d.apr >= HIGH_INTEREST_APR,
    balance: d.balance,
    apr: d.apr,
    minPayment: d.minPayment,
    payoffMonth: ahead.debts[i].payoffMonth,
    payoffDate: ahead.debts[i].payoffDate,
  }));
  const patches = weeds.reduce((a, w) => a + w.patches, 0);
  const owed = debts.reduce((a, d) => a + d.balance, 0);
  const weedsEl = {
    id: "weeds",
    name: "Weeds",
    state: patches,
    label: patches ? `${patches} weed ${patches === 1 ? "patch" : "patches"}` : "No weeds",
    value: money(owed),
    title: "Debt owed",
    calc: debts.length
      ? `${money(owed)} owed across ${debts.length} ${debts.length === 1 ? "debt" : "debts"}. One patch for every ${money(DEBT_PER_WEED)} on each debt (up to ${MAX_WEEDS_PER_DEBT}). Debts at ${pct(HIGH_INTEREST_APR)} APR or more grow thorny brambles.`
      : "No debt, so no weeds.",
    weeds,
  };

  // Season clock: today is spring; the debt-free date on the player's plan is the Harvest Festival.
  const debt = debtFreeSummary(profile.debts, { extra: plan.extraDebt, strategy: plan.strategy, now });
  let seasonEl;
  if (!debt.hasDebt) {
    seasonEl = { id: "season", name: "Season", state: "harvest", label: "Harvest Festival is here", value: "No debt", title: "Harvest Festival", calc: "With no debt to clear, it's harvest time already." };
  } else if (!debt.plan.date) {
    seasonEl = { id: "season", name: "Season", state: "spring", label: "Spring, harvest date not set yet", value: "Not yet", title: "Harvest Festival", calc: debt.sentence };
  } else {
    seasonEl = {
      id: "season",
      name: "Season",
      state: "spring",
      label: `Spring now, Harvest Festival in ${debt.plan.months} months`,
      value: debt.plan.date,
      title: "Harvest Festival",
      calc: `Your debt-free date on your plan with ${money(debt.extra)} extra a month. ${debt.base.date ? `Paying only the minimums, it would be ${debt.base.date}.` : "Paying only the minimums, it might never come."}`,
    };
  }

  // Visitors from the health score.
  const visitors = VISITORS.filter((v) => healthScore >= v.at).map((v) => v.name);
  const visitorsEl = {
    id: "visitors",
    name: "Visitors",
    state: visitors.length,
    label: visitors.length ? `${listJoin(visitors)[0].toUpperCase()}${listJoin(visitors).slice(1)} stop by` : "Visitors arrive as habits grow",
    value: `${Math.round(healthScore)}/100`,
    title: "Health score",
    calc: `Your health score is ${Math.round(healthScore)} out of 100. Butterflies come at 40, bees at 60 and birds at 80.`,
    visitors,
  };

  // Flowers from learning: one for each money word.
  const flowersEl = {
    id: "flowers",
    name: "Flowers",
    state: learned,
    label: learned ? `${learned} ${learned === 1 ? "flower" : "flowers"}` : "Flower seeds waiting",
    value: `${learned} of ${wordTotal}`,
    title: "Money words learned",
    calc: `You've learned ${learned} of ${wordTotal} money words. Each one plants a flower.`,
  };

  const elements = [soilEl, greenhouseEl, weedsEl, flowersEl, visitorsEl, seasonEl];
  const description =
    `Your garden has ${soilEl.label.toLowerCase()}, a greenhouse at the “${greenhouseEl.label.toLowerCase()}” stage, ` +
    `${weedsEl.label.toLowerCase()}, ${flowersEl.label.toLowerCase()}, and ${visitors.length ? `${listJoin(visitors)} visiting` : "no visitors yet"}. ` +
    `${seasonEl.label}.`;
  return { elements, byId: Object.fromEntries(elements.map((e) => [e.id, e])), description };
}

const SEASONS = ["Spring", "Summer", "Autumn"];

/**
 * One frame of "Fast-forward to Harvest Festival": the garden `t` months from now on the plan shown
 * (`ahead` from payoffLookahead). Patches clear on their projected months; the greenhouse grows with
 * the plan's monthly emergency-fund money; the season moves from spring to the festival. A projection:
 * it assumes today's balances, rates, minimums and monthly amounts hold.
 * Returns { t, total, date, cleared: Set("debt-k"), clearedDebts, patchesLeft, emergencyMonths,
 * greenhouse: { stage, label }, season, done }.
 */
export function lapseFrame({ ahead, profile, m, t, now = new Date() }) {
  const total = ahead.months ?? 0;
  const month = Math.max(0, Math.min(total, t));
  const cleared = new Set();
  let patchesLeft = 0;
  const clearedDebts = [];
  ahead.debts.forEach((d, i) => {
    d.patchMonths.forEach((pm, k) => {
      if (pm != null && pm <= month) cleared.add(`${i}-${k}`);
      else patchesLeft += 1;
    });
    if (d.payoffMonth != null && d.payoffMonth <= month) clearedDebts.push(d.name);
  });
  const monthly = (profile.allocation ?? []).find((a) => a.key === "emergency")?.monthly ?? 0;
  const emergencyMonths = m.essential > 0 ? (m.emergencyBalance + monthly * month) / m.essential : 0;
  const stage = greenhouseStage(emergencyMonths);
  const done = total > 0 && month >= total;
  const season = done ? "Harvest Festival" : SEASONS[Math.min(2, Math.floor((month / Math.max(1, total)) * 3))];
  return {
    t: month,
    total,
    date: addMonths(now, month),
    cleared,
    clearedDebts,
    patchesLeft,
    emergencyMonths,
    emergencyMonthly: monthly,
    greenhouse: { stage, label: GREENHOUSE[stage] },
    season,
    done,
  };
}
