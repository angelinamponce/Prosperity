import { debtOutlook, encounterOrder, healthFraction, minimumsOnly, newlyCleared, sproutHint } from "../debtBattle";
import { emptyProgress, reduce } from "../rules";
import { computeMetrics, simulatePayoff } from "../../dashboard/finance";
import { sampleProfile } from "../../dashboard/sampleProfile";

const now = new Date(2026, 9, 1);
const debts = sampleProfile.debts;

test("encounters follow the plan's order: highest interest first, or smallest balance first", () => {
  expect(encounterOrder(debts, "avalanche").map((d) => d.name)).toEqual(["Credit card", "Car loan", "Student loan"]);
  expect(encounterOrder(debts, "snowball").map((d) => d.name)).toEqual(["Credit card", "Car loan", "Student loan"]);
  const swapped = [{ name: "A", balance: 900, apr: 0.05, minPayment: 50 }, { name: "B", balance: 5000, apr: 0.2, minPayment: 100 }];
  expect(encounterOrder(swapped, "avalanche").map((d) => d.name)).toEqual(["B", "A"]);
  expect(encounterOrder(swapped, "snowball").map((d) => d.name)).toEqual(["A", "B"]);
});

test("each debt's date is the payoff simulation's, and more extra never makes one later", () => {
  const saved = debtOutlook(debts, { extra: 300, now });
  const run = simulatePayoff(debts, { extra: 300, strategy: "avalanche" });
  for (const d of run.payoffOrder) expect(saved.byName[d.name].months).toBe(d.month);
  const more = debtOutlook(debts, { extra: 800, now });
  for (const name of Object.keys(saved.byName)) expect(more.byName[name].months).toBeLessThanOrEqual(saved.byName[name].months);
  expect(more.interest).toBeLessThan(saved.interest);
});

test("the health bar is the share of minimums-only time still left, so paying more 'damages' it", () => {
  const mins = minimumsOnly(debts, now);
  const card = mins["Credit card"].months;
  const saved = debtOutlook(debts, { extra: 300, now }).byName["Credit card"].months;
  const more = debtOutlook(debts, { extra: 800, now }).byName["Credit card"].months;
  expect(healthFraction(card, card)).toBe(1);
  expect(healthFraction(more, card)).toBeLessThan(healthFraction(saved, card));
  expect(healthFraction(null, card)).toBe(1); // never clears: full bar, no pretend damage
  expect(healthFraction(0, card)).toBeGreaterThan(0); // always a sliver, never "defeated" by a what-if
});

test("Sprout's hint is honest about spare money and never pushes past it", () => {
  const m = computeMetrics(sampleProfile);
  const order = encounterOrder(debts);
  const hint = sproutHint(debts[0], { m, plan: { extraDebt: 300, strategy: "avalanche" }, order });
  expect(hint).toMatch(/22\.9% APR/);
  expect(hint).toMatch(/Only plan extra you can keep paying/);
  const tight = sproutHint(debts[0], { m: { ...m, surplus: -50 }, plan: { extraDebt: 0, strategy: "avalanche" }, order });
  expect(tight).toMatch(/Minimums first/);
});

test("a real victory only when the survey shows a debt it once had at $0, and only once", () => {
  const survey = { ...sampleProfile, fromSurvey: true };
  let p = reduce(emptyProgress(), { type: "noteDebts", names: survey.debts.map((d) => d.name), at: 1 }).progress;
  expect(newlyCleared(p, survey)).toEqual([]);
  const paidCard = { ...survey, debts: survey.debts.map((d) => (d.name === "Credit card" ? { ...d, balance: 0 } : d)) };
  expect(newlyCleared(p, paidCard)).toEqual(["Credit card"]);
  const r = reduce(p, { type: "debtCleared", name: "Credit card", at: 2 });
  expect(r.events).toEqual([{ type: "debtCleared", name: "Credit card" }]);
  expect(r.progress.xp).toBe(0); // money never earns XP
  p = r.progress;
  expect(newlyCleared(p, paidCard)).toEqual([]);
  // Sample numbers never count, even if they differ from what the survey showed.
  expect(newlyCleared(p, { ...sampleProfile, debts: [] })).toEqual([]);
  // A debt never seen can't be "cleared".
  expect(reduce(emptyProgress(), { type: "debtCleared", name: "Mystery" }).events).toEqual([]);
});
