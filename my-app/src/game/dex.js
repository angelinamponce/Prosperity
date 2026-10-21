// The Garden Dex: one plant species for each money word in the glossary. Each entry has a plain reason
// the plant fits the idea, and "Show me with my numbers": the word worked out with the player's own
// figures, using only numbers the dashboard already calculates. Assumptions are labeled; when the
// survey doesn't have a number, the entry says so instead of guessing.

import { addMonths, simulatePayoff } from "../dashboard/finance";
import { money, pct } from "../design/format";

/** Species for each glossary key, in Dex order (dashboard words first, then quiz words). */
export const DEX = [
  { key: "netWorth", species: "Balance Fern", why: "Two fronds weighed against each other: what you own and what you owe." },
  { key: "healthScore", species: "Vital Sunflower", why: "It turns to the light as everyday habits improve." },
  { key: "savingsRate", species: "Saver Bean", why: "Each pod is a share of income kept instead of spent." },
  { key: "emergencyFund", species: "Sturdy Oak", why: "Deep roots that hold through a storm." },
  { key: "surplus", species: "Spare Clover", why: "The extra leaf: what's left once the bills are paid." },
  { key: "flexible", species: "Bendy Willow", why: "It bends without breaking, like costs you can adjust." },
  { key: "payoffOrder", species: "Snowball Bush", why: "Round blooms that pile up one win at a time." },
  { key: "apr", species: "Thorny Bramble", why: "The higher the rate, the sharper the thorns." },
  { key: "match", species: "Twin Tulip", why: "You plant one, and your employer plants one beside it." },
  { key: "investOptions", species: "Three-Pot Herb", why: "Three pots for three kinds of growth: slow and safe to bigger swings." },
  { key: "simulation", species: "Weather Daisy", why: "Many daisies, each grown in a different season's weather." },
  { key: "fi", species: "Evergreen Pine", why: "Green all year, without needing new planting." },
  { key: "budget", species: "Row Lettuce", why: "Planted in neat rows, each with its own space." },
  { key: "needsWants", species: "Root and Bloom", why: "The root you need to live; the bloom that's nice to have." },
  { key: "rule503020", species: "Portion Pumpkin", why: "Three sections: half, a bit less than a third, and a fifth." },
  { key: "payYourselfFirst", species: "First Radish", why: "The first thing harvested, before anything else." },
  { key: "minimumPayment", species: "Slowcreep Moss", why: "It covers ground, but slowly." },
  { key: "compoundInterest", species: "Compound Vine", why: "Each new loop grows from the last, so it speeds up over time." },
  { key: "creditScore", species: "Trust Bamboo", why: "It grows one steady ring at a time." },
  { key: "creditUtilization", species: "Measure Cactus", why: "A cactus that marks how full it's getting." },
  { key: "inflation", species: "Drift Dandelion", why: "Its seeds float up a little at a time, like prices." },
  { key: "indexFund", species: "Meadow Mix", why: "A whole meadow from one packet of many seeds." },
  { key: "diversification", species: "Berry Bush", why: "Berries on every branch, so one bad branch doesn't ruin the crop." },
  { key: "hysa", species: "Water Lily", why: "Calm, safe water where things still grow." },
];

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const ASSUME = "Assumes today's numbers stay the same.";

// Per-word numbers. Each returns { text, assumption? } built from the player's profile and metrics.
const NUMBERS = {
  netWorth: ({ m }) => ({ text: `You own ${money(m.assets)} and owe ${money(m.totalDebt)}, so your net worth is ${money(m.assets)} − ${money(m.totalDebt)} = ${money(m.netWorth)}.` }),

  healthScore: ({ grade }) => {
    const parts = [...grade.parts].sort((a, b) => b.score - a.score);
    const best = parts[0];
    const low = parts[parts.length - 1];
    return {
      text:
        `Your score is ${Math.round(grade.score)} out of 100, from ${parts.length} habits. ` +
        `Strongest: ${best.label.toLowerCase()} (${Math.round(best.score)}/100). Most room to grow: ${low.label.toLowerCase()} (${Math.round(low.score)}/100).`,
    };
  },

  savingsRate: ({ m }) =>
    m.surplus >= 0
      ? { text: `${money(m.surplus)} kept ÷ ${money(m.income)} income = ${pct(m.savingsRate, 1)} of each month's income.` }
      : { text: `Right now ${money(-m.surplus)} more goes out than comes in each month, so the savings rate is below zero (${pct(m.savingsRate, 1)}). Any month that turns positive is a win.` },

  emergencyFund: ({ m }) =>
    m.essential > 0
      ? {
          text:
            `${money(m.emergencyBalance)} saved ÷ ${money(m.essential)} of essentials a month = ${m.emergencyMonths.toFixed(1)} months. ` +
            `The usual 3 to 6 month goal is ${money(m.essential * 3)} to ${money(m.essential * 6)}.`,
        }
      : { text: "No essential costs are recorded yet, so there's nothing to measure the fund against." },

  surplus: ({ m }) => ({ text: `${money(m.income)} in − ${money(m.expenses)} spending − ${money(m.minDebt)} minimum debt payments = ${money(m.surplus)} a month.` }),

  flexible: ({ m }) => ({ text: `About ${money(m.discretionary)} of your ${money(m.expenses)} monthly spending is flexible: ${pct(m.discretionaryShare)} of income.` }),

  payoffOrder: ({ profile, plan, now }) => {
    const debts = profile.debts.filter((d) => d.balance > 0);
    if (debts.length < 2) return { text: debts.length ? "With one debt, both strategies pay it the same way." : "No debts, so there's nothing to order." };
    const run = (strategy) => simulatePayoff(debts, { extra: plan.extraDebt, strategy });
    const a = run("avalanche");
    const s = run("snowball");
    const when = (r) => (r.months < 600 ? addMonths(now, r.months) : "not yet");
    return {
      text:
        `With ${money(plan.extraDebt)} extra a month: highest interest first finishes by ${when(a)} with ${money(a.interest)} in interest; ` +
        `smallest balance first finishes by ${when(s)} with ${money(s.interest)}.`,
      assumption: ASSUME,
    };
  },

  apr: ({ profile }) => {
    const d = [...profile.debts].filter((x) => x.balance > 0).sort((x, y) => y.apr - x.apr)[0];
    if (!d) return { text: "You have no debts, so no APR is costing you right now." };
    return { text: `Your ${d.name} has a ${pct(d.apr, 1)} APR. On ${money(d.balance)}, that's about ${money((d.balance * d.apr) / 12)} of interest this month (${money(d.balance)} × ${pct(d.apr, 1)} ÷ 12).` };
  },

  match: ({ profile, m }) => {
    if (m.matchCaptured == null) return { text: "The survey doesn't ask about your employer's match yet, so there's no number to show." };
    const r = profile.retirement;
    if (m.matchMissedAnnual <= 0) return { text: `You put in ${pct(r.contributionRate)} and your employer matches up to ${pct(r.matchUpTo)}, so you're getting the full match.` };
    return {
      text: `You put in ${pct(r.contributionRate)} and your employer matches up to ${pct(r.matchUpTo)}. Raising yours to ${pct(r.matchUpTo)} would add about ${money(m.matchMissedAnnual)} a year from your employer.`,
      assumption: "Assumes a dollar-for-dollar match on a salary of " + money(r.salaryAnnual) + ".",
    };
  },

  investOptions: ({ m }) => ({ text: `Today you have ${money(m.cash)} in cash accounts (safest, slower growth) and ${money(m.invested)} invested (more growth, more ups and downs).` }),

  simulation: ({ profile, m }) => ({
    text: `The Possible futures page replays 500 markets over your ${m.yearsToRetire} years until age ${profile.retirementAge}, starting from your ${money(m.invested)} invested.`,
  }),

  fi: ({ m }) => ({
    text: `You spend ${money(m.expenses)} a month, ${money(m.expenses * 12)} a year. 25 times that is ${money(m.fiNumber)}. You have ${money(m.invested)} invested today.`,
    assumption: "The 25× rule of thumb, in today's dollars.",
  }),

  budget: ({ m }) => ({ text: `${money(m.income)} comes in each month: ${money(m.expenses)} to spending, ${money(m.minDebt)} to minimum payments, and ${money(m.surplus)} left to direct.` }),

  needsWants: ({ profile, m }) => {
    const needs = sum(profile.expenses.filter((e) => e.essential).map((e) => e.monthly));
    return { text: `Your essential bills come to ${money(needs)} a month. About ${money(m.discretionary)} of your spending is flexible, the part that can wait or shrink.` };
  },

  rule503020: ({ profile, m }) => {
    if (m.income <= 0) return { text: "No income is recorded yet, so there's nothing to split." };
    const needs = m.essential;
    const wants = m.expenses - sum(profile.expenses.filter((e) => e.essential).map((e) => e.monthly));
    const share = (v) => pct(v / m.income);
    return {
      text: `Yours: about ${share(needs)} needs (essential bills and minimum payments), ${share(wants)} wants, and ${share(m.surplus)} saving and extra debt payments. The rule of thumb is 50/30/20.`,
      assumption: "Counts essential bills as needs and the rest of spending as wants.",
    };
  },

  payYourselfFirst: ({ m }) =>
    m.surplus > 0
      ? { text: `Moving your ${money(m.surplus)} monthly surplus into savings on payday means it's saved before it can be spent.` }
      : { text: "Once a month ends with money left over, even a small automatic transfer on payday is a good start." },

  minimumPayment: ({ profile, now }) => {
    const d = [...profile.debts].filter((x) => x.balance > 0).sort((x, y) => y.apr - x.apr)[0];
    if (!d) return { text: "You have no debts, so there are no minimum payments." };
    const interest = (d.balance * d.apr) / 12;
    const run = simulatePayoff([d], { extra: 0 });
    const when = run.months < 600 ? `paid off by ${addMonths(now, run.months)}` : "never paid off, because interest outpaces it";
    return {
      text: `Your ${d.name}'s minimum is ${money(d.minPayment)}. About ${money(interest)} of it goes to interest this month, so ${money(Math.max(0, d.minPayment - interest))} shrinks the balance. Paying only the minimum, it's ${when}.`,
      assumption: ASSUME,
    };
  },

  compoundInterest: ({ profile, m }) => {
    const acct = profile.accounts.find((a) => a.apy) ?? null;
    const bal = acct ? acct.balance : m.emergencyBalance;
    const rate = acct ? acct.apy : 0.04;
    const ten = bal * (1 + rate) ** 10;
    return {
      text: `${money(bal)} earning ${pct(rate, 1)} a year, with nothing added, grows to about ${money(ten)} in 10 years: ${money(ten - bal)} of growth, partly interest earned on interest.`,
      assumption: acct ? `Assumes ${acct.name}'s rate stays at ${pct(rate, 1)}.` : "Assumes a 4% yearly rate, for illustration.",
    };
  },

  creditScore: ({ profile }) => {
    const n = profile.debts.filter((d) => d.balance > 0).length;
    return { text: `The survey doesn't ask for your credit score, so there's no number to show. ${n ? `Paying your ${n} ${n === 1 ? "minimum" : "minimums"} on time every month matters most.` : "Paying every bill on time matters most."}` };
  },

  creditUtilization: ({ profile }) => {
    const card = profile.debts.find((d) => /card/i.test(d.name) && d.balance > 0);
    if (!card) return { text: "No credit card balance is recorded, so utilization isn't affecting you right now." };
    return { text: `The survey doesn't ask for card limits. To stay under 30% with your ${money(card.balance)} ${card.name} balance, the limit would need to be at least ${money(card.balance / 0.3)}.` };
  },

  inflation: ({ m }) => ({
    text: `At 3% a year, your ${money(m.expenses)} monthly spending would cost about ${money(m.expenses * 1.03 ** 10)} in 10 years for the same things.`,
    assumption: "Assumes 3% inflation every year; real inflation varies.",
  }),

  indexFund: ({ m }) => ({ text: `You have ${money(m.invested)} invested. In a broad index fund, that would be spread across hundreds of companies at once.` }),

  diversification: ({ m }) => {
    if (m.assets <= 0) return { text: "No savings or assets are recorded yet, so there's nothing to spread out." };
    const other = m.assets - m.cash - m.invested;
    return { text: `Your ${money(m.assets)} is spread across cash (${pct(m.cash / m.assets)}), investments (${pct(m.invested / m.assets)}) and other things you own (${pct(other / m.assets)}).` };
  },

  hysa: ({ profile, m }) => {
    const acct = profile.accounts.find((a) => a.apy);
    if (acct) return { text: `Your ${acct.name} pays ${pct(acct.apy, 1)}: about ${money((acct.balance * acct.apy) / 12)} a month on ${money(acct.balance)}.`, assumption: "Rates can change." };
    return { text: `At 4% a year, your ${money(m.cash)} in cash would earn about ${money(m.cash * 0.04)} a year.`, assumption: "Assumes a 4% rate, for illustration; your account's rate may differ." };
  },
};

/** "Show me with my numbers" for one word: { text, assumption? }. */
export function dexNumbers(key, { profile, m, plan, grade, now = new Date() }) {
  return NUMBERS[key]({ profile, m, plan, grade, now });
}
