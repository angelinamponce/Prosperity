import { deriveGarden } from "../garden";
import { addMonths, computeMetrics, gradeBreakdown, simulatePayoff } from "../../dashboard/finance";
import { sampleProfile } from "../../dashboard/sampleProfile";
import { debtFreeSummary } from "../../dashboard/summaries";

const now = new Date(2026, 9, 1);
const plan = { extraDebt: 300, strategy: "avalanche" };
const build = (profile, extra = {}) => {
  const m = computeMetrics(profile);
  return deriveGarden({ profile, m, plan, healthScore: gradeBreakdown(m).score, learned: 7, wordTotal: 24, now, ...extra });
};

test("the sample plan, element by element, with the numbers behind each", () => {
  const g = build(sampleProfile);
  const m = computeMetrics(sampleProfile);
  expect(g.byId.soil).toMatchObject({ state: "lush", value: "35.2%" }); // 35% kept
  expect(g.byId.greenhouse).toMatchObject({ state: 3, label: "Roof on", value: "3.4 months" });
  // $3,200 card -> 2 thorny patches; $8,400 car -> 4; $14,400 student -> 6 (capped)
  expect(g.byId.weeds.weeds.map(({ name, patches, thorny }) => ({ name, patches, thorny }))).toEqual([
    { name: "Credit card", patches: 2, thorny: true },
    { name: "Car loan", patches: 4, thorny: false },
    { name: "Student loan", patches: 6, thorny: false },
  ]);
  // Each debt's payoff date is the one on the saved plan.
  const run = simulatePayoff(sampleProfile.debts, { extra: 300, strategy: "avalanche" });
  for (const w of g.byId.weeds.weeds) {
    expect(w.payoffDate).toBe(addMonths(now, run.payoffOrder.find((d) => d.name === w.name).month));
  }
  expect(g.byId.weeds.label).toBe("12 weed patches");
  expect(g.byId.flowers).toMatchObject({ state: 7, value: "7 of 24" });
  expect(g.byId.visitors.visitors).toEqual(["butterflies", "bees", "a bird"]);
  const debt = debtFreeSummary(sampleProfile.debts, { ...plan, extra: 300, now });
  expect(g.byId.season.value).toBe(debt.plan.date);
  expect(g.byId.season.calc).toMatch(/on your plan with \$300 extra a month/);
  expect(g.byId.soil.calc).toContain(`÷ $${Math.round(m.income).toLocaleString("en-US")} income`);
  for (const e of g.elements) expect(e.calc).toBeTruthy();
});

test("the garden follows the numbers: change the survey, the garden changes", () => {
  const paidOff = { ...sampleProfile, debts: [] };
  const g = build(paidOff);
  expect(g.byId.weeds).toMatchObject({ state: 0, label: "No weeds" });
  expect(g.byId.season).toMatchObject({ state: "harvest", label: "Harvest Festival is here" });
});

test("hard times look like a resting garden, never a dead one", () => {
  const tight = { ...sampleProfile, income: [{ name: "Pay", monthly: 2500 }], accounts: [] };
  const g = build(tight, { healthScore: 20, learned: 0 });
  expect(g.byId.soil.label).toBe("Resting soil");
  expect(g.byId.greenhouse.label).toBe("Just a plot");
  expect(g.byId.visitors.label).toBe("Visitors arrive as habits grow");
  expect(g.byId.flowers.label).toBe("Flower seeds waiting");
  expect(g.description).not.toMatch(/dead|dying|wilt|fail/i);
});

test("a plain-language description for screen readers", () => {
  const g = build(sampleProfile);
  expect(g.description).toMatch(/^Your garden has lush soil, a greenhouse at the “roof on” stage, 12 weed patches, 7 flowers, and butterflies, bees and a bird visiting\. Spring now, Harvest Festival in \d+ months\.$/);
});

describe("payoffLookahead: when a plan clears each debt and each weed patch", () => {
  const { payoffLookahead, LOOKAHEAD_MONTHS } = require("../garden");
  const saved = payoffLookahead(sampleProfile.debts, { extra: 300, strategy: "avalanche", now });

  test("agrees with the saved plan's debt-free date and each debt's payoff", () => {
    expect(saved.date).toBe(debtFreeSummary(sampleProfile.debts, { extra: 300, strategy: "avalanche", now }).plan.date);
    const run = simulatePayoff(sampleProfile.debts, { extra: 300, strategy: "avalanche" });
    for (const d of saved.debts) expect(d.payoffMonth).toBe(run.payoffOrder.find((p) => p.name === d.name).month);
  });

  test("patches planted last clear first, and the first patch clears with the debt", () => {
    for (const d of saved.debts) {
      expect(d.patchMonths[0]).toBe(d.payoffMonth);
      for (let k = 1; k < d.patchMonths.length; k += 1) expect(d.patchMonths[k]).toBeLessThanOrEqual(d.patchMonths[k - 1]);
      expect(d.patchMonths.every((m) => m > 0)).toBe(true); // nothing is shown as cleared today
    }
  });

  test("paying more never clears anything later, and clears more within the year", () => {
    const more = payoffLookahead(sampleProfile.debts, { extra: 800, strategy: "avalanche", now });
    const within = (r) => r.debts.flatMap((d) => d.patchMonths).filter((m) => m != null && m <= LOOKAHEAD_MONTHS).length;
    more.debts.forEach((d, i) => d.patchMonths.forEach((m, k) => expect(m).toBeLessThanOrEqual(saved.debts[i].patchMonths[k])));
    expect(within(more)).toBeGreaterThan(within(saved));
    expect(more.months).toBeLessThan(saved.months);
  });

  test("minimums that never catch up give no dates rather than made-up ones; no debt gives nothing to clear", () => {
    const stuck = payoffLookahead([{ name: "Card", balance: 10000, apr: 0.3, minPayment: 100 }], { now });
    expect(stuck.date).toBeNull();
    expect(stuck.debts[0].payoffDate).toBeNull();
    expect(payoffLookahead([], { now })).toEqual({ debts: [], months: 0, date: null });
  });
});

describe("lapseFrame: Fast-forward to Harvest Festival", () => {
  const { lapseFrame, payoffLookahead } = require("../garden");
  const m = computeMetrics(sampleProfile);
  const ahead = payoffLookahead(sampleProfile.debts, { extra: 300, strategy: "avalanche", now });
  const at = (t) => lapseFrame({ ahead, profile: sampleProfile, m, t, now });

  test("today nothing is cleared; at the end everything is, on the debt-free date, at the festival", () => {
    const start = at(0);
    expect(start.cleared.size).toBe(0);
    expect(start.patchesLeft).toBe(12);
    expect(start.season).toBe("Spring");
    const end = at(ahead.months);
    expect(end.done).toBe(true);
    expect(end.season).toBe("Harvest Festival");
    expect(end.patchesLeft).toBe(0);
    expect(end.date).toBe(ahead.date);
    expect(end.clearedDebts).toEqual(["Credit card", "Car loan", "Student loan"]);
    expect(at(ahead.months + 50).t).toBe(ahead.months); // never runs past the festival
  });

  test("patches only ever clear going forward, and each debt clears on its own payoff month", () => {
    let prev = -1;
    for (let t = 0; t <= ahead.months; t += 1) {
      const f = at(t);
      expect(f.cleared.size).toBeGreaterThanOrEqual(prev);
      prev = f.cleared.size;
    }
    for (const d of ahead.debts) {
      expect(at(d.payoffMonth).clearedDebts).toContain(d.name);
      expect(at(d.payoffMonth - 1).clearedDebts).not.toContain(d.name);
    }
  });

  test("the greenhouse grows with the plan's monthly emergency-fund money", () => {
    const f = at(12);
    expect(f.emergencyMonthly).toBe(900);
    expect(f.emergencyMonths).toBeCloseTo((m.emergencyBalance + 900 * 12) / m.essential, 6);
    expect(f.greenhouse.stage).toBeGreaterThanOrEqual(at(0).greenhouse.stage);
  });
});
