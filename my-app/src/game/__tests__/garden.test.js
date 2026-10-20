import { deriveGarden } from "../garden";
import { computeMetrics, gradeBreakdown } from "../../dashboard/finance";
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
  expect(g.byId.weeds.weeds).toEqual([
    { name: "Credit card", patches: 2, thorny: true },
    { name: "Car loan", patches: 4, thorny: false },
    { name: "Student loan", patches: 6, thorny: false },
  ]);
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
