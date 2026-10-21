import { DEX, dexNumbers } from "../dex";
import { DEX_ART, DEX_PALETTE, SEED_PACKET } from "../../world/dexArt";
import { GLOSSARY } from "../../dashboard/glossary";
import { computeMetrics, gradeBreakdown } from "../../dashboard/finance";
import { sampleProfile } from "../../dashboard/sampleProfile";
import { profileFromRows } from "../../dashboard/profileFromRows";

const now = new Date(2026, 9, 1);
const plan = { extraDebt: 300, strategy: "avalanche" };
const ctxFor = (profile) => {
  const m = computeMetrics(profile);
  return { profile, m, plan, grade: gradeBreakdown(m), now };
};
// A real survey profile: one debt, no employer match, no named card.
const survey = profileFromRows({
  user: { id: 7, name: "Sam", age: 24 },
  income: { user_id: 7, annual_income: 60000 },
  savings: { user_id: 7, current_amount: 4000, interest_rate: 0.04, checking_account: 1500, saving_investment_account: false },
  spending: { user_id: 7, rent_utilities: 1400, groceries_food: 120, debt_payment: 250, debt_interest: 0.18, debt_left: 6000, others: 80, debt: null },
});
const debtFree = { ...sampleProfile, debts: [] };

test("one Dex species for every money word, each with its own original art", () => {
  expect(DEX.map((d) => d.key).sort()).toEqual(Object.keys(GLOSSARY).sort());
  expect(new Set(DEX.map((d) => d.species)).size).toBe(DEX.length);
  for (const d of DEX) {
    const rows = DEX_ART[d.key];
    expect(rows).toHaveLength(24);
    expect(rows.every((r) => r.length === 24 && [...r].every((ch) => ch === "." || DEX_PALETTE[ch]))).toBe(true);
    expect(rows.join("").replace(/[.o]/g, "").length).toBeGreaterThan(40); // not an empty sprite
  }
  expect(new Set(Object.values(DEX_ART).map((r) => r.join(""))).size).toBe(DEX.length); // no two alike
  expect(SEED_PACKET).toHaveLength(24);
});

test("Show me with my numbers works for every word on the sample, a real survey, and a debt-free plan", () => {
  for (const profile of [sampleProfile, survey, debtFree]) {
    const ctx = ctxFor(profile);
    for (const d of DEX) {
      const n = dexNumbers(d.key, ctx);
      expect(n.text).toBeTruthy();
      expect(n.text).not.toMatch(/NaN|undefined|Infinity|null/);
    }
  }
});

test("the numbers are the dashboard's own figures", () => {
  const ctx = ctxFor(sampleProfile);
  const { m } = ctx;
  expect(dexNumbers("netWorth", ctx).text).toContain(`= $${Math.round(m.netWorth).toLocaleString("en-US")}`);
  expect(dexNumbers("apr", ctx).text).toBe("Your Credit card has a 22.9% APR. On $3,200, that's about $61 of interest this month ($3,200 × 22.9% ÷ 12).");
  expect(dexNumbers("emergencyFund", ctx).text).toContain(`${m.emergencyMonths.toFixed(1)} months`);
  // The 50/30/20 shares add up to all of income.
  const shares = dexNumbers("rule503020", ctx).text.match(/(\d+)%/g).slice(0, 3).map((x) => parseInt(x, 10));
  expect(Math.abs(shares.reduce((a, b) => a + b, 0) - 100)).toBeLessThanOrEqual(1);
});

test("assumptions are labeled, and missing survey numbers are admitted rather than guessed", () => {
  const ctx = ctxFor(sampleProfile);
  for (const k of ["inflation", "compoundInterest", "fi", "payoffOrder", "minimumPayment"]) expect(dexNumbers(k, ctx).assumption).toBeTruthy();
  expect(dexNumbers("creditScore", ctx).text).toMatch(/doesn't ask for your credit score/);
  const s = ctxFor(survey);
  expect(dexNumbers("match", s).text).toMatch(/doesn't ask about your employer's match/);
  expect(dexNumbers("apr", ctxFor(debtFree)).text).toBe("You have no debts, so no APR is costing you right now.");
});
