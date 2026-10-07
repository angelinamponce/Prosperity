// Turns a user's Supabase rows (Users, Income, Savings, Spending) into the profile shape the
// dashboard pages use. Pure, so it is easy to test. Field meanings follow SignUp.jsx and the
// original Dashboard.jsx: annual_income is yearly; groceries_food and others are weekly;
// rent_utilities and debt_payment are monthly; interest rates are stored as fractions.

import { computeMetrics, EMERGENCY_TARGET_MONTHS } from "./finance";

export const WEEKS_PER_MONTH = 52 / 12;
export const DEFAULT_AGE = 30; // used only when the survey's optional age field is blank
export const DEFAULT_RETIREMENT_AGE = 60; // matches the dashboard's default plan

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** True when the user has saved at least one of the money steps of the survey. */
export function hasFinancialRows({ income, savings, spending }) {
  return Boolean(income || savings || spending);
}

// A starting split of the monthly surplus, since the survey doesn't ask how the user divides it.
// Shown on the Overview as a suggestion.
function suggestAllocation(surplus, needsEmergencyFund, hasDebt) {
  if (surplus <= 0) return [];
  const weights = needsEmergencyFund
    ? hasDebt
      ? { emergency: 0.5, debt: 0.3, invest: 0.2 }
      : { emergency: 0.6, invest: 0.4 }
    : hasDebt
    ? { debt: 0.5, invest: 0.5 }
    : { invest: 1 };
  const names = { emergency: "Emergency fund", debt: "Extra debt payments", invest: "Investing" };
  const slots = { emergency: 1, debt: 3, invest: 4 };
  const keys = Object.keys(weights);
  let assigned = 0;
  return keys.map((key, i) => {
    // Round to whole dollars and give any rounding remainder to the last bucket so the parts add up.
    const monthly = i === keys.length - 1 ? Math.round(surplus) - assigned : Math.round(surplus * weights[key]);
    assigned += monthly;
    return { key, name: names[key], monthly, slot: slots[key] };
  });
}

export function profileFromRows({ user, income, savings, spending }) {
  const annualIncome = num(income?.annual_income);
  const debtBalance = num(spending?.debt_left);
  const debtPayment = num(spending?.debt_payment);

  const expenses = [
    { key: "housing", name: "Rent & utilities", short: "Housing", monthly: num(spending?.rent_utilities), essential: true, slot: 1 },
    { key: "food", name: "Groceries & food", short: "Food", monthly: num(spending?.groceries_food) * WEEKS_PER_MONTH, essential: true, discretionary: 0.35, slot: 2 },
    { key: "other", name: "Other expenses", short: "Other", monthly: num(spending?.others) * WEEKS_PER_MONTH, discretionary: 1, slot: 6 },
  ];
  // A payment with no balance on record still leaves the budget each month.
  if (debtPayment && !debtBalance) {
    expenses.push({ key: "debtPayments", name: "Debt payments", short: "Debt", monthly: debtPayment, essential: true, slot: 3 });
  }

  const debts = debtBalance
    ? [{ name: spending?.debt?.trim() || "Debt", balance: debtBalance, apr: num(spending?.debt_interest), minPayment: debtPayment }]
    : [];

  const accounts = [
    { name: "Checking", kind: "cash", balance: num(savings?.checking_account) },
    { name: "Savings", kind: "cash", balance: num(savings?.current_amount), apy: num(savings?.interest_rate), emergency: true },
  ];

  const profile = {
    name: user?.name?.trim() || "",
    age: num(user?.age) || DEFAULT_AGE,
    ageAssumed: !num(user?.age),
    retirementAge: DEFAULT_RETIREMENT_AGE,
    literacy: "",
    income: annualIncome ? [{ name: "Income", monthly: annualIncome / 12 }] : [],
    expenses: expenses.filter((e) => e.monthly > 0),
    debts,
    accounts,
    otherAssets: [],
    // The survey doesn't ask about 401(k) contributions or an employer match yet.
    retirement: { salaryAnnual: annualIncome, contributionRate: 0, matchUpTo: 0, unknown: true },
    allocation: [],
    allocationSuggested: true,
    goals: [],
    history: null,
    fromSurvey: true,
  };

  const m = computeMetrics(profile);
  profile.allocation = suggestAllocation(m.surplus, m.emergencyMonths < EMERGENCY_TARGET_MONTHS, debts.length > 0);
  // One snapshot: there is no month-by-month history in the database yet.
  profile.history = {
    months: ["Now"],
    netWorth: [m.netWorth],
    income: [m.income],
    spending: [m.expenses],
    emergencyMonths: [m.emergencyMonths],
  };
  return profile;
}
