// Questions built from the player's own plan numbers. Every answer is calculated with the dashboard's
// finance functions, never typed by hand. When a number is missing (no debt yet, no survey), the
// question uses clearly labeled example numbers instead.
//
// Each template takes { profile, metrics } and returns
// { prompt, choices, correct, explain, numbers: [{ label, value }], example, assumption? } or null.

import { growthSeries, simulatePayoff } from "../dashboard/finance";
import { duration, money, pct } from "../design/format";

const distinct = (xs) => new Set(xs).size === xs.length;
const roundTo = (v, step) => Math.round(v / step) * step;

// Builds the question from real numbers, falling back to the example when they don't make a fair question.
function withFallback(build, real, example) {
  const own = real && build(real, false);
  return own && distinct(own.choices) ? own : build(example, true);
}

function savingsRate({ metrics: m }) {
  const real = m.income > 0 && m.surplus > 0 ? { income: m.income, keep: m.surplus } : null;
  return withFallback(
    ({ income, keep }, example) => {
      const r = keep / income;
      return {
        prompt: `Each month you take home ${money(income)} and have about ${money(keep)} left after bills and minimum debt payments. What's your savings rate?`,
        choices: [pct(r), pct(1 - r), pct(r / 2), pct(Math.min(0.95, r * 2))],
        correct: 0,
        explain: `Savings rate = what you keep ÷ what you take home: ${money(keep)} ÷ ${money(income)} ≈ ${pct(r)}. Around 20% is a great goal, but every bit counts.`,
        numbers: [{ label: "Take-home pay", value: `${money(income)}/mo` }, { label: "Left over", value: `${money(keep)}/mo` }],
        example,
      };
    },
    real,
    { income: 3000, keep: 450 }
  );
}

function monthlyInterest({ profile }) {
  const debt = [...profile.debts].filter((d) => d.balance > 0 && d.apr > 0).sort((a, b) => b.apr - a.apr)[0];
  return withFallback(
    ({ name, balance, apr }, example) => {
      const monthly = (balance * apr) / 12;
      return {
        prompt: `Your ${name.toLowerCase()} has a ${money(balance)} balance at ${pct(apr, 1)} APR. About how much interest is added in one month?`,
        choices: [money(monthly), money(balance * apr), money(monthly / 2), money(monthly * 2)],
        correct: 0,
        explain: `APR is a yearly rate, so divide by 12: ${money(balance)} × ${pct(apr, 1)} ÷ 12 ≈ ${money(monthly)} a month. That's about ${money(balance * apr)} a year if the balance stays the same.`,
        assumption: "Simplified: card companies usually figure interest daily, so the exact amount can differ a little.",
        numbers: [{ label: "Balance", value: money(balance) }, { label: "APR", value: pct(apr, 1) }],
        example,
      };
    },
    debt && { name: debt.name, balance: debt.balance, apr: debt.apr },
    { name: "Credit card", balance: 3000, apr: 0.22 }
  );
}

function extraPayment({ profile }) {
  const build = (debts, example) => {
    const base = simulatePayoff(debts, { extra: 0, rollover: false });
    const plus = simulatePayoff(debts, { extra: 100, rollover: false });
    const saved = base.months - plus.months;
    // Payments that never finish, or an extra $100 that barely matters, don't make a fair question.
    if (base.months >= 600 || saved < 3) return null;
    return {
      prompt: `Paying only the minimums, your debt would be paid off in about ${duration(base.months)}. About how much sooner would an extra $100 a month get you there?`,
      choices: [duration(saved), "No sooner at all", duration(Math.max(1, Math.round(saved / 3))), duration(saved * 2)],
      correct: 0,
      explain: `With $100 extra, payoff takes about ${duration(plus.months)} instead of ${duration(base.months)}. That's about ${duration(saved)} sooner, and about ${money(base.interest - plus.interest)} less interest.`,
      numbers: [
        { label: "Total owed", value: money(debts.reduce((a, d) => a + d.balance, 0)) },
        { label: "Minimum payments", value: `${money(debts.reduce((a, d) => a + d.minPayment, 0))}/mo` },
      ],
      example,
    };
  };
  const real = profile.debts.length ? build(profile.debts, false) : null;
  if (real && distinct(real.choices)) return real;
  return build([{ name: "Credit card", balance: 5000, apr: 0.2, minPayment: 150 }], true);
}

function emergencyTarget({ metrics: m }) {
  return withFallback(
    ({ essential }, example) => ({
      prompt: `Your essential costs (housing, food, bills and minimum debt payments) are about ${money(essential)} a month. How much would 3 months of essentials be?`,
      choices: [money(essential * 3), money(essential), money(essential * 12), money(essential / 3)],
      correct: 0,
      explain: `${money(essential)} × 3 = ${money(essential * 3)}. Many people aim for 3 to 6 months. Starting smaller is completely fine: every month covered is a real cushion.`,
      numbers: [{ label: "Essentials", value: `${money(essential)}/mo` }],
      example,
    }),
    m.essential > 0 ? { essential: m.essential } : null,
    { essential: 2000 }
  );
}

// Always example numbers: it's about how growth works, not about the player's plan.
function contributionsVsGrowth() {
  const monthly = 200;
  const years = 30;
  const rate = 0.055;
  const put = monthly * 12 * years;
  const grown = growthSeries(0, monthly, rate, years)[years];
  const about = (v) => `About ${money(roundTo(v, 1000))}`;
  return {
    prompt: `You invest $${monthly} a month for ${years} years, putting in ${money(put)} in total. If it grows about ${pct(rate, 1)} a year after inflation, roughly what could it be worth?`,
    choices: [about(grown), about(put), about(put * 1.1), "About $1,000,000"],
    correct: 0,
    explain: `Growth earns growth on top of itself (compounding), so ${money(put)} put in could grow to about ${money(roundTo(grown, 1000))}. More than half of that would be growth, not your own deposits.`,
    assumption: `Assumes a steady ${pct(rate, 1)} yearly return after inflation, a long-run average for a stock index fund. It is not a promise: real returns go up and down and could be lower.`,
    numbers: [{ label: "Monthly", value: `$${monthly}` }, { label: "Years", value: String(years) }, { label: "Assumed growth", value: `${pct(rate, 1)}/yr` }],
    example: true,
  };
}

export const TEMPLATES = { savingsRate, monthlyInterest, extraPayment, emergencyTarget, contributionsVsGrowth };
