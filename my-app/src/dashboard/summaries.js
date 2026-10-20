// Plain-English sentences built from the plan's numbers. Pure, so every wording is tested.
// Each sentence says which plan a date belongs to, and keeps the exact figures alongside for "Show the numbers".

import { addMonths, simulatePayoff } from "./finance";
import { money } from "../design/format";

const NEVER = 600; // simulatePayoff stops here: the debt isn't paid off at this pace

/** "8 months", "1 year", "3 and a half years": rounded to the nearest half year past 12 months. */
export function humanDuration(months) {
  if (months < 1) return "less than a month";
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"}`;
  const halves = Math.round(months / 6);
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  if (whole === 1 && !half) return "1 year";
  return `${whole}${half ? " and a half" : ""} years`;
}

/**
 * Compares "your plan" (minimums plus `extra` each month, with each paid-off debt's minimum rolling into
 * the next, the same plan the Debt page shows) against paying only the minimums.
 */
export function debtFreeSummary(debts, { extra = 0, strategy = "avalanche", now = new Date() } = {}) {
  const owed = debts.filter((d) => d.balance > 0);
  if (!owed.length) {
    return { hasDebt: false, sentence: "You don't have any debt to pay off, which leaves lots of room to grow." };
  }
  const base = simulatePayoff(owed, { extra: 0, rollover: false });
  const plan = simulatePayoff(owed, { extra, strategy });
  const baseNever = base.months >= NEVER;
  const planNever = plan.months >= NEVER;
  const sooner = baseNever ? null : base.months - plan.months;
  const out = {
    hasDebt: true,
    extra,
    plan: { months: plan.months, date: planNever ? null : addMonths(now, plan.months), interest: plan.interest },
    base: { months: base.months, date: baseNever ? null : addMonths(now, base.months), interest: base.interest },
    monthsSooner: sooner,
    interestSaved: Math.max(0, base.interest - plan.interest),
  };
  const extraText = `${money(extra)} extra a month`;

  if (planNever) {
    return {
      ...out,
      sentence: `At this pace the debt wouldn't get paid off, because interest grows about as fast as the payments. Even a small extra payment can change that.`,
      detail: null,
    };
  }
  if (baseNever) {
    return {
      ...out,
      sentence: `With ${extraText}, you could be debt-free by ${out.plan.date}. Paying only the minimums, it might never be paid off.`,
      detail: null,
    };
  }
  if (sooner < 1) {
    return { ...out, sentence: `Paying the minimums, you could be debt-free by ${out.base.date}.`, detail: null };
  }
  const sentence =
    extra > 0
      ? `With ${extraText}, you could be debt-free about ${humanDuration(sooner)} sooner than paying only the minimums.`
      : `Even with no extra, moving each paid-off debt's payment to the next one gets you debt-free about ${humanDuration(sooner)} sooner than paying only the minimums.`;
  return { ...out, sentence, detail: `That's ${out.plan.date} on this plan, instead of ${out.base.date} with minimums only.` };
}

const STRATEGY = { avalanche: "highest interest first", snowball: "smallest balance first" };

/**
 * Two or three short sentences for the dashboard summary strip. Each sentence is a list of parts:
 * plain strings, or { value, title, calc } numbers the player can tap to see how they were worked out.
 */
export function planSummary(profile, m, plan, now = new Date()) {
  const sentences = [];

  if (m.surplus > 0) {
    sentences.push([
      "You keep about ",
      {
        value: money(m.surplus),
        title: "Left over each month",
        calc: `${money(m.income)} income − ${money(m.expenses)} spending − ${money(m.minDebt)} minimum debt payments = ${money(m.surplus)}.`,
      },
      " each month after bills and minimum debt payments.",
    ]);
  } else {
    sentences.push([
      "Right now, bills and minimum payments use up all of your ",
      {
        value: money(m.income),
        title: "Monthly income",
        calc: `${money(m.income)} income − ${money(m.expenses)} spending − ${money(m.minDebt)} minimum debt payments = ${money(m.surplus)}.`,
      },
      " a month. That's a common place to start, and small changes add up fast.",
    ]);
  }

  const debt = debtFreeSummary(profile.debts, { extra: plan.extraDebt, strategy: plan.strategy, now });
  if (!debt.hasDebt) {
    sentences.push([debt.sentence]);
  } else if (debt.plan.date) {
    const how = `Every minimum payment plus ${money(debt.extra)} extra a month, ${STRATEGY[plan.strategy] ?? STRATEGY.avalanche}, moving each paid-off debt's payment to the next.`;
    sentences.push([
      `On your plan with ${money(debt.extra)} extra a month, you'd be debt-free by `,
      {
        value: debt.plan.date,
        title: "Your debt-free date",
        calc: `${how} ${debt.base.date ? `Paying only the minimums, it would be ${debt.base.date}.` : "Paying only the minimums, it might never be paid off."}`,
      },
      ".",
    ]);
  } else {
    sentences.push([debt.sentence]);
  }

  if (m.emergencyBalance > 0 && m.essential > 0) {
    sentences.push([
      "Your savings would cover about ",
      {
        value: `${m.emergencyMonths.toFixed(1)} months`,
        title: "Emergency cushion",
        calc: `${money(m.emergencyBalance)} saved ÷ ${money(m.essential)} of essentials a month = ${m.emergencyMonths.toFixed(1)} months. Many people aim for 3 to 6.`,
      },
      " of essential costs.",
    ]);
  } else {
    sentences.push(["You haven't started an emergency fund yet. Even a small amount each week is a great start."]);
  }
  return sentences;
}
