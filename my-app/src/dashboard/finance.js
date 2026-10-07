// Pure financial calculations. No React here, so everything is easy to unit test.

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const HIGH_INTEREST_APR = 0.08;
export const EMERGENCY_TARGET_MONTHS = 6;

export function computeMetrics(p) {
  const income = sum(p.income.map((i) => i.monthly));
  const expenses = sum(p.expenses.map((e) => e.monthly));
  const minDebt = sum(p.debts.map((d) => d.minPayment));
  const surplus = income - expenses - minDebt;

  const cash = sum(p.accounts.filter((a) => a.kind === "cash").map((a) => a.balance));
  const invested = sum(p.accounts.filter((a) => a.kind === "invest").map((a) => a.balance));
  const assets = cash + invested + sum(p.otherAssets.map((a) => a.value));
  const totalDebt = sum(p.debts.map((d) => d.balance));

  const essential = sum(p.expenses.filter((e) => e.essential).map((e) => e.monthly)) + minDebt;
  const emergencyBalance = sum(p.accounts.filter((a) => a.emergency).map((a) => a.balance));
  const housing = p.expenses.find((e) => e.key === "housing")?.monthly ?? 0;
  const discretionary = sum(p.expenses.map((e) => e.monthly * (e.discretionary ?? 0)));
  const highInterestDebt = sum(p.debts.filter((d) => d.apr >= HIGH_INTEREST_APR).map((d) => d.balance));
  const weightedApr = totalDebt ? sum(p.debts.map((d) => d.balance * d.apr)) / totalDebt : 0;

  const { salaryAnnual, contributionRate, matchUpTo } = p.retirement;
  const matchMissedAnnual = Math.max(0, matchUpTo - contributionRate) * salaryAnnual;

  return {
    income,
    expenses,
    minDebt,
    surplus,
    savingsRate: income ? surplus / income : 0,
    cash,
    invested,
    assets,
    totalDebt,
    netWorth: assets - totalDebt,
    essential,
    emergencyBalance,
    emergencyMonths: essential ? emergencyBalance / essential : 0,
    emergencyTarget: essential * EMERGENCY_TARGET_MONTHS,
    debtToIncome: income ? minDebt / income : 0,
    housingRatio: income ? housing / income : 0,
    discretionary,
    discretionaryShare: income ? discretionary / income : 0,
    highInterestDebt,
    weightedApr,
    matchMissedAnnual,
    // null when we don't know the employer's match (the survey doesn't ask yet).
    matchCaptured: p.retirement.unknown ? null : matchUpTo ? Math.min(1, contributionRate / matchUpTo) : 1,
    yearsToRetire: Math.max(1, p.retirementAge - p.age),
    // 25x annual spending (the "4% rule") in today's dollars.
    fiNumber: expenses * 12 * 25,
  };
}

// Each part scores 0-100; weights sum to 1.
export function gradeBreakdown(m) {
  const parts = [
    { key: "savings", label: "Savings rate", weight: 0.25, score: clamp(m.savingsRate / 0.2, 0, 1) * 100 },
    { key: "safety", label: "Emergency fund", weight: 0.2, score: clamp(m.emergencyMonths / EMERGENCY_TARGET_MONTHS, 0, 1) * 100 },
    { key: "debt", label: "Debt load", weight: 0.15, score: clamp((0.4 - m.debtToIncome) / 0.3, 0, 1) * 100 },
    { key: "interest", label: "High-interest debt", weight: 0.15, score: clamp(1 - m.highInterestDebt / (m.income * 3 || 1), 0, 1) * 100 },
    { key: "match", label: "Employer match", weight: 0.1, score: m.matchCaptured == null ? null : m.matchCaptured * 100 },
    { key: "housing", label: "Housing cost", weight: 0.15, score: clamp((0.5 - m.housingRatio) / 0.2, 0, 1) * 100 },
  ].filter((p) => p.score != null);
  // Unknown habits are left out and the remaining weights scaled back up to 100%.
  const totalWeight = sum(parts.map((p) => p.weight));
  const score = sum(parts.map((p) => p.score * p.weight)) / totalWeight;
  return { score, letter: letterFor(score), parts };
}

export function letterFor(score) {
  const cuts = [[93, "A"], [90, "A-"], [87, "B+"], [83, "B"], [80, "B-"], [77, "C+"], [73, "C"], [70, "C-"], [60, "D"]];
  return cuts.find(([c]) => score >= c)?.[1] ?? "F";
}

/**
 * Month-by-month debt payoff.
 * strategy: "avalanche" (highest APR first) or "snowball" (smallest balance first).
 * rollover: when a debt is paid off, its minimum payment goes to the next debt.
 */
export function simulatePayoff(debts, { extra = 0, strategy = "avalanche", rollover = true } = {}) {
  const ds = debts.map((d) => ({ ...d, bal: d.balance, paidMonth: null }));
  const order = [...ds].sort(strategy === "avalanche" ? (a, b) => b.apr - a.apr : (a, b) => a.bal - b.bal);
  const fixedBudget = sum(ds.map((d) => d.minPayment)) + extra;
  const total = () => sum(ds.map((d) => d.bal));
  const balances = [total()];
  let interest = 0;
  let month = 0;

  while (total() > 0.01 && month < 600) {
    month += 1;
    for (const d of ds) {
      if (d.bal <= 0) continue;
      const i = (d.bal * d.apr) / 12;
      d.bal += i;
      interest += i;
    }
    let available = rollover ? fixedBudget : sum(ds.filter((d) => d.bal > 0).map((d) => d.minPayment)) + extra;
    for (const d of ds) {
      if (d.bal <= 0) continue;
      const pay = Math.min(d.minPayment, d.bal, available);
      d.bal -= pay;
      available -= pay;
    }
    for (const d of order) {
      if (available <= 0) break;
      if (d.bal <= 0) continue;
      const pay = Math.min(available, d.bal);
      d.bal -= pay;
      available -= pay;
    }
    for (const d of ds) {
      if (d.bal <= 0.01 && d.paidMonth == null) {
        d.bal = 0;
        d.paidMonth = month;
      }
    }
    balances.push(total());
  }

  return {
    months: month,
    interest,
    balances,
    payoffOrder: [...ds].sort((a, b) => a.paidMonth - b.paidMonth).map((d) => ({ name: d.name, apr: d.apr, month: d.paidMonth })),
  };
}

// Year-end balances with monthly contributions and monthly compounding.
export function growthSeries(start, monthly, annualRate, years) {
  const r = annualRate / 12;
  const out = [start];
  let bal = start;
  for (let y = 1; y <= years; y += 1) {
    for (let mth = 0; mth < 12; mth += 1) bal = bal * (1 + r) + monthly;
    out.push(bal);
  }
  return out;
}

// Assumed long-run average returns after inflation. Shown to users as assumptions.
export const STRATEGIES = [
  { key: "hysa", name: "High-yield savings", rate: 0.01, slot: 1 },
  { key: "bonds", name: "Bond index fund", rate: 0.02, slot: 2 },
  { key: "balanced", name: "Balanced 60/40", rate: 0.04, slot: 3 },
  { key: "stocks", name: "Total stock market", rate: 0.055, slot: 4 },
];

// Small seeded RNG so the simulation doesn't jitter while sliders move.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Monte Carlo of portfolio value in today's dollars.
 * Returns yearly percentile bands, a few sample paths, and the chance of ending at or above `goal`.
 */
export function monteCarlo({ start, monthly, stockShare, years, goal, sims = 500, seed = 42, samplePaths = 24 }) {
  const rand = mulberry32(seed);
  const gauss = () => {
    const u = 1 - rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const mu = stockShare * 0.055 + (1 - stockShare) * 0.015;
  const vol = Math.sqrt((stockShare * 0.16) ** 2 + ((1 - stockShare) * 0.06) ** 2);
  const m = mu / 12;
  const sd = vol / Math.sqrt(12);

  const byYear = Array.from({ length: years + 1 }, () => new Float64Array(sims));
  const paths = [];
  let hits = 0;

  for (let s = 0; s < sims; s += 1) {
    let bal = start;
    byYear[0][s] = bal;
    const path = s < samplePaths ? [bal] : null;
    for (let y = 1; y <= years; y += 1) {
      for (let k = 0; k < 12; k += 1) bal = bal * Math.exp(m - (sd * sd) / 2 + sd * gauss()) + monthly;
      byYear[y][s] = bal;
      if (path) path.push(bal);
    }
    if (path) paths.push(path);
    if (bal >= goal) hits += 1;
  }

  const pct = (arr, q) => arr[Math.min(arr.length - 1, Math.floor(q * arr.length))];
  const bands = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (const arr of byYear) {
    arr.sort();
    bands.p10.push(pct(arr, 0.1));
    bands.p25.push(pct(arr, 0.25));
    bands.p50.push(pct(arr, 0.5));
    bands.p75.push(pct(arr, 0.75));
    bands.p90.push(pct(arr, 0.9));
  }
  return { bands, paths, successRate: hits / sims, expectedReturn: mu, volatility: vol };
}

export function monthsToTarget(current, target, monthly) {
  if (current >= target) return 0;
  if (monthly <= 0) return Infinity;
  return Math.ceil((target - current) / monthly);
}

export function addMonths(date, months) {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function monthsUntil(ym, from = new Date()) {
  const [y, mo] = ym.split("-").map(Number);
  return (y - from.getFullYear()) * 12 + (mo - 1 - from.getMonth());
}

/**
 * Rule-based recommendations, in priority order. Each one cites the numbers it came from.
 */
export function buildRecommendations(p, m, plan) {
  const recs = [];
  const fmt = (v) => "$" + Math.round(v).toLocaleString("en-US");

  if (m.emergencyMonths < 1) {
    recs.push({
      id: "starter-ef",
      title: "Build a starter emergency fund",
      because: `You have ${m.emergencyMonths.toFixed(1)} months of essentials saved.`,
      impact: `Target ${fmt(m.essential)}`,
      page: "goals",
    });
  }
  if (m.matchMissedAnnual > 0) {
    recs.push({
      id: "match",
      title: "Get your full 401(k) match (it's free money)",
      because: `You contribute ${(p.retirement.contributionRate * 100).toFixed(0)}% but your employer matches up to ${(p.retirement.matchUpTo * 100).toFixed(0)}%.`,
      impact: `+${fmt(m.matchMissedAnnual)}/yr free`,
      page: "invest",
    });
  }
  const hi = [...p.debts].filter((d) => d.apr >= HIGH_INTEREST_APR).sort((a, b) => b.apr - a.apr)[0];
  if (hi) {
    const base = simulatePayoff(p.debts, { extra: 0, rollover: false });
    const planned = simulatePayoff(p.debts, { extra: plan.extraDebt, strategy: "avalanche" });
    recs.push({
      id: "avalanche",
      title: `Pay off your ${hi.name.toLowerCase()} first`,
      because: `At ${(hi.apr * 100).toFixed(1)}% interest a year, this debt costs you more than almost any investment could safely earn.`,
      impact: `Save ${fmt(base.interest - planned.interest)} interest`,
      page: "debt",
    });
  }
  if (m.emergencyMonths >= 1 && m.emergencyMonths < EMERGENCY_TARGET_MONTHS) {
    const monthly = p.allocation.find((a) => a.key === "emergency")?.monthly ?? 0;
    const left = monthsToTarget(m.emergencyBalance, m.emergencyTarget, monthly);
    recs.push({
      id: "ef",
      title: "Finish your 6-month emergency fund",
      because: `You're at ${m.emergencyMonths.toFixed(1)} of ${EMERGENCY_TARGET_MONTHS} months.`,
      impact: Number.isFinite(left) ? `${left} months to go` : "Add a monthly amount",
      page: "goals",
    });
  }
  if (m.discretionaryShare > 0.1) {
    recs.push({
      id: "trim",
      title: "Put some flexible spending to work",
      because: `About ${fmt(m.discretionary)}/mo of your spending is flexible.`,
      impact: `10% = ${fmt(m.discretionary * 0.1 * 12)}/yr`,
      page: "cash-flow",
    });
  }
  return recs;
}

// Assumed long-run yearly growth after inflation, used to show what freed-up money could become.
export const TRIM_GROWTH_RATE = 0.055;

/**
 * What happens if flexible spending is cut by `trim` (0 to 1).
 * Only the discretionary share of each category is reduced.
 */
export function trimSpending(p, m, trim) {
  const expenses = p.expenses.map((e) => ({ ...e, planned: e.monthly - e.monthly * (e.discretionary ?? 0) * trim }));
  const saved = m.expenses - sum(expenses.map((e) => e.planned));
  const surplus = m.surplus + saved;
  return {
    expenses,
    saved,
    surplus,
    savingsRate: m.income ? surplus / m.income : 0,
    tenYearValue: growthSeries(0, saved, TRIM_GROWTH_RATE, 10)[10],
  };
}

/** Progress and timing for the emergency fund, house and 401(k)-match goals. */
export function goalStatus(p, m, now = new Date()) {
  const alloc = (key) => p.allocation.find((a) => a.key === key)?.monthly ?? 0;

  const efMonthly = alloc("emergency");
  const emergency = {
    current: m.emergencyBalance,
    target: m.emergencyTarget,
    monthly: efMonthly,
    monthsLeft: monthsToTarget(m.emergencyBalance, m.emergencyTarget, efMonthly),
  };

  const houseGoal = p.goals.find((g) => g.key === "house");
  let house = null;
  if (houseGoal) {
    const current = p.accounts.find((a) => a.name === houseGoal.account)?.balance ?? 0;
    const monthly = alloc("house");
    const monthsLeft = monthsToTarget(current, houseGoal.target, monthly);
    const deadlineMonths = monthsUntil(houseGoal.targetDate, now);
    house = {
      name: houseGoal.name,
      current,
      target: houseGoal.target,
      monthly,
      monthsLeft,
      deadlineMonths,
      neededMonthly: Math.ceil((houseGoal.target - current) / Math.max(1, deadlineMonths)),
      onTrack: monthsLeft <= deadlineMonths,
    };
  }

  const { contributionRate, matchUpTo, salaryAnnual } = p.retirement;
  const match = {
    current: contributionRate * salaryAnnual,
    target: matchUpTo * salaryAnnual,
    contributionRate,
    matchUpTo,
    missedAnnual: m.matchMissedAnnual,
    onTrack: contributionRate >= matchUpTo,
  };

  return { emergency, house, match };
}
