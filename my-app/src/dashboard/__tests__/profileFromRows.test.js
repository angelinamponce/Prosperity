import { DEFAULT_AGE, WEEKS_PER_MONTH, hasFinancialRows, profileFromRows } from "../profileFromRows";
import { buildRecommendations, computeMetrics, gradeBreakdown, goalStatus } from "../finance";
import { sampleProfile } from "../sampleProfile";

// Rows shaped like the ones SignUp.jsx saves (rates stored as fractions).
const rows = {
  user: { id: 7, name: "  Sam Rivera ", email: "sam@example.com", age: 24 },
  income: { user_id: 7, annual_income: 60000 },
  savings: { user_id: 7, current_amount: 4000, interest_rate: 0.04, checking_account: 1500, saving_investment_account: false },
  spending: { user_id: 7, rent_utilities: 1400, groceries_food: 120, debt_payment: 250, debt_interest: 0.18, debt_left: 6000, others: 80, debt: null },
};

test("detects new users who haven't saved any money rows", () => {
  expect(hasFinancialRows({ income: null, savings: null, spending: null })).toBe(false);
  expect(hasFinancialRows({ income: rows.income, savings: null, spending: null })).toBe(true);
});

test("converts survey units to monthly amounts", () => {
  const p = profileFromRows(rows);
  expect(p.name).toBe("Sam Rivera");
  expect(p.age).toBe(24);
  expect(p.income).toEqual([{ name: "Income", monthly: 5000 }]);
  const byKey = Object.fromEntries(p.expenses.map((e) => [e.key, e.monthly]));
  expect(byKey.housing).toBe(1400);
  expect(byKey.food).toBeCloseTo(120 * WEEKS_PER_MONTH, 6);
  expect(byKey.other).toBeCloseTo(80 * WEEKS_PER_MONTH, 6);
  expect(p.debts).toEqual([{ name: "Debt", balance: 6000, apr: 0.18, minPayment: 250 }]);
  expect(p.accounts.find((a) => a.emergency).balance).toBe(4000);
});

test("metrics computed from real rows add up", () => {
  const p = profileFromRows(rows);
  const m = computeMetrics(p);
  const expenses = 1400 + 200 * WEEKS_PER_MONTH;
  expect(m.income).toBe(5000);
  expect(m.expenses).toBeCloseTo(expenses, 6);
  expect(m.surplus).toBeCloseTo(5000 - expenses - 250, 6);
  expect(m.netWorth).toBe(4000 + 1500 - 6000);
});

test("the suggested split of the surplus adds up to the whole surplus", () => {
  const p = profileFromRows(rows);
  const m = computeMetrics(p);
  const total = p.allocation.reduce((a, x) => a + x.monthly, 0);
  expect(total).toBe(Math.round(m.surplus));
  expect(p.allocation.map((a) => a.key)).toEqual(["emergency", "debt", "invest"]);
  expect(p.allocationSuggested).toBe(true);
});

test("no surplus means no suggested split", () => {
  const p = profileFromRows({ ...rows, income: { annual_income: 12000 } });
  expect(computeMetrics(p).surplus).toBeLessThan(0);
  expect(p.allocation).toEqual([]);
});

test("a debt payment without a balance still counts as monthly spending", () => {
  const p = profileFromRows({ ...rows, spending: { ...rows.spending, debt_left: 0 } });
  expect(p.debts).toEqual([]);
  expect(p.expenses.find((e) => e.key === "debtPayments").monthly).toBe(250);
});

test("missing values become zeros or safe defaults, never NaN", () => {
  const p = profileFromRows({ user: { id: 1 }, income: null, savings: null, spending: { rent_utilities: "900" } });
  expect(p.name).toBe("");
  expect(p.age).toBe(DEFAULT_AGE);
  expect(p.ageAssumed).toBe(true);
  const m = computeMetrics(p);
  for (const [k, v] of Object.entries(m)) if (typeof v === "number") expect([k, Number.isNaN(v)]).toEqual([k, false]);
  expect(p.history.months).toEqual(["Now"]);
});

test("an unknown 401(k) match is left out of the health score and recommendations", () => {
  const p = profileFromRows(rows);
  const m = computeMetrics(p);
  const grade = gradeBreakdown(m);
  expect(grade.parts.map((x) => x.key)).not.toContain("match");
  expect(grade.score).toBeGreaterThanOrEqual(0);
  expect(grade.score).toBeLessThanOrEqual(100);
  expect(buildRecommendations(p, m, { extraDebt: 300 }).map((r) => r.id)).not.toContain("match");
  expect(goalStatus(p, m).house).toBeNull();
});

test("the sample profile's score is unchanged by the new weighting", () => {
  const grade = gradeBreakdown(computeMetrics(sampleProfile));
  expect(grade.parts).toHaveLength(6);
  expect(grade.score).toBeCloseTo(84.7, 0);
});
