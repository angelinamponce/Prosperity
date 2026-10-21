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

// ---------- More questions from the player's own numbers ----------

function savingsShare503020({ metrics: m }) {
  return withFallback(
    ({ income }, example) => ({
      prompt: `You take home about ${money(income)} a month. Under the 50/30/20 rule, about how much would go to savings and extra debt payments?`,
      choices: [money(income * 0.2), money(income * 0.3), money(income * 0.5), money(income * 0.1)],
      correct: 0,
      explain: `20% of ${money(income)} is about ${money(income * 0.2)}. The rule's 50% for needs and 30% for wants are a starting point; adjust them to fit your life.`,
      numbers: [{ label: "Take-home pay", value: `${money(income)}/mo` }],
      example,
    }),
    m.income > 0 ? { income: m.income } : null,
    { income: 3000 }
  );
}

function trimFlexible({ metrics: m }) {
  return withFallback(
    ({ flexible }, example) => ({
      prompt: `${example ? "Say about" : "About"} ${money(flexible)} of ${example ? "someone's" : "your"} monthly spending is flexible, like dining out, shopping and subscriptions. Trimming that by 10% would free up about how much each month?`,
      choices: [money(flexible * 0.1), money(flexible), money(flexible * 0.5), money(flexible * 0.25)],
      correct: 0,
      explain: `10% of ${money(flexible)} is about ${money(flexible * 0.1)} a month, or about ${money(flexible * 1.2)} a year. Small trims to flexible spending add up without touching your needs.`,
      numbers: [{ label: "Flexible spending", value: `${money(flexible)}/mo` }],
      example,
    }),
    m.discretionary >= 50 ? { flexible: m.discretionary } : null,
    { flexible: 600 }
  );
}

function minimumOnlyTime({ profile }) {
  const debt = [...profile.debts].filter((d) => d.balance > 0 && d.apr > 0).sort((a, b) => b.apr - a.apr)[0];
  const build = ({ name, balance, apr, minPayment }, example) => {
    const run = simulatePayoff([{ name, balance, apr, minPayment }], { extra: 0 });
    if (run.months >= 600 || run.months < 3) return null; // never-ending or trivial: not a fair question
    return {
      prompt: `${example ? "A" : "Your"} ${name.toLowerCase()} has ${money(balance)} at ${pct(apr, 1)} APR, with a ${money(minPayment)} minimum. Paying only the minimum, about how long until it's paid off?`,
      choices: [duration(run.months), duration(Math.max(1, Math.round(run.months / 3))), duration(run.months * 3), "Less than a month"],
      correct: 0,
      explain: `Paying only ${money(minPayment)} a month, it takes about ${duration(run.months)} and about ${money(run.interest)} in interest. Even a little extra each month shortens that a lot.`,
      assumption: "Assumes the balance, rate and minimum stay the same and nothing new is added.",
      numbers: [{ label: "Balance", value: money(balance) }, { label: "APR", value: pct(apr, 1) }, { label: "Minimum", value: `${money(minPayment)}/mo` }],
      example,
    };
  };
  const real = debt ? build(debt, false) : null;
  if (real && distinct(real.choices)) return real;
  return build({ name: "Credit card", balance: 2500, apr: 0.22, minPayment: 75 }, true);
}

function utilizationLimit({ profile }) {
  const card = profile.debts.find((d) => /card/i.test(d.name) && d.balance > 0);
  return withFallback(
    ({ balance }, example) => ({
      prompt: `${example ? "A" : "Your"} credit card balance is ${money(balance)}. To keep credit utilization under 30%, the card's limit would need to be at least about how much?`,
      choices: [money(balance / 0.3), money(balance * 0.3), money(balance * 1.3), money(balance * 30)],
      correct: 0,
      explain: `Utilization = balance ÷ limit, so the limit needs to be at least ${money(balance)} ÷ 30% ≈ ${money(balance / 0.3)}. Paying the balance down lowers utilization too, which is usually the better move.`,
      numbers: [{ label: "Card balance", value: money(balance) }],
      example,
    }),
    card ? { balance: card.balance } : null,
    { balance: 1500 }
  );
}

function savingsInterest({ profile }) {
  const acct = profile.accounts.find((a) => a.apy > 0 && a.balance > 0);
  return withFallback(
    ({ balance, apy }, example) => ({
      prompt: `${example ? "A savings account" : "Your savings account"} has ${money(balance)} earning ${pct(apy, 1)} a year. About how much interest would it earn in a year?`,
      choices: [money(balance * apy), money((balance * apy) / 12), money(balance * apy * 10), money(balance * 0.25)],
      correct: 0,
      explain: `${money(balance)} × ${pct(apy, 1)} ≈ ${money(balance * apy)} in a year, a bit more if the interest compounds monthly. Your money stays easy to reach while it earns.`,
      assumption: "Assumes the rate stays the same for the year; savings rates can change.",
      numbers: [{ label: "Balance", value: money(balance) }, { label: "Yearly rate", value: pct(apy, 1) }],
      example,
    }),
    acct ? { balance: acct.balance, apy: acct.apy } : null,
    { balance: 5000, apy: 0.04 }
  );
}

function emergencyMonthsCovered({ metrics: m }) {
  const months = (v) => `About ${v.toFixed(1)} months`;
  return withFallback(
    ({ saved, essential }, example) => {
      const n = saved / essential;
      return {
        prompt: `${example ? "Someone has" : "You have"} ${money(saved)} in emergency savings, and essentials cost about ${money(essential)} a month. About how many months would it cover?`,
        choices: [months(n), months(n * 2), months(n / 2), months(n + 6)],
        correct: 0,
        explain: `${money(saved)} ÷ ${money(essential)} ≈ ${n.toFixed(1)} months. Many people aim for 3 to 6; every month covered is a real cushion.`,
        numbers: [{ label: "Emergency savings", value: money(saved) }, { label: "Essentials", value: `${money(essential)}/mo` }],
        example,
      };
    },
    m.emergencyBalance > 0 && m.essential > 0 ? { saved: m.emergencyBalance, essential: m.essential } : null,
    { saved: 3000, essential: 2000 }
  );
}

function employerMatch({ profile }) {
  const r = profile.retirement;
  return withFallback(
    ({ salary, upTo }, example) => ({
      prompt: `${example ? "Someone's" : "Your"} salary is about ${money(salary)} a year, and the employer matches up to ${pct(upTo)}. Putting in ${pct(upTo)}, about how much would the employer add each year?`,
      choices: [money(salary * upTo), money(salary * upTo * 2), money((salary * upTo) / 12), "Nothing extra"],
      correct: 0,
      explain: `${pct(upTo)} of ${money(salary)} is about ${money(salary * upTo)} a year from the employer, on top of what you put in. That's why getting the full match is often a first step.`,
      assumption: "Assumes a dollar-for-dollar match. Some employers match less (for example 50 cents per dollar), so check your plan.",
      numbers: [{ label: "Salary", value: `${money(salary)}/yr` }, { label: "Match up to", value: pct(upTo) }],
      example,
    }),
    !r?.unknown && r?.salaryAnnual > 0 && r?.matchUpTo > 0 ? { salary: r.salaryAnnual, upTo: r.matchUpTo } : null,
    { salary: 50000, upTo: 0.04 }
  );
}

function fiNumber({ metrics: m }) {
  return withFallback(
    ({ yearly }, example) => ({
      prompt: `${example ? "Someone spends" : "You spend"} about ${money(yearly)} a year. Using the "25 times your yearly spending" rule of thumb, roughly how much would financial independence take?`,
      choices: [money(yearly * 25), money(yearly * 4), money(yearly * 100), money(yearly * 10)],
      correct: 0,
      explain: `${money(yearly)} × 25 = ${money(yearly * 25)}. The idea: a portfolio that size could cover spending of about 4% of it each year. It's a rough guide, not a guarantee.`,
      assumption: "A rule of thumb based on past markets; it can't promise future results.",
      numbers: [{ label: "Yearly spending", value: money(yearly) }],
      example,
    }),
    m.expenses > 0 ? { yearly: m.expenses * 12 } : null,
    { yearly: 36000 }
  );
}

export const TEMPLATES = {
  savingsRate,
  monthlyInterest,
  extraPayment,
  emergencyTarget,
  contributionsVsGrowth,
  savingsShare503020,
  trimFlexible,
  minimumOnlyTime,
  utilizationLimit,
  savingsInterest,
  emergencyMonthsCovered,
  employerMatch,
  fiNumber,
};

