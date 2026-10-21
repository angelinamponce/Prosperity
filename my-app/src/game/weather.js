// The Weather Station forecast: the same 500 simulated markets as the Possible futures page, sorted
// into three skies by where each future ends up at retirement:
//   sunny  = reaches the financial-independence goal (25 times a year of spending)
//   mixed  = gets at least halfway there
//   stormy = ends less than halfway
// Nothing is guaranteed and the garden never loses anything to a storm; the forecast also shows what
// could brighten it. Same inputs as the Future page, so the numbers always agree.

import { monteCarlo } from "../dashboard/finance";
import { money, pct } from "../design/format";

export const SKIES = {
  sunny: { label: "Sunny", means: "reaches your financial-independence goal" },
  mixed: { label: "Mixed", means: "gets at least halfway there" },
  stormy: { label: "Stormy", means: "ends less than halfway" },
};

/** The simulation inputs, exactly as the Future page builds them. */
export function forecastInputs(profile, m, plan, change = {}) {
  const retireAge = (plan.retireAge ?? profile.retirementAge) + (change.laterYears ?? 0);
  return {
    start: m.invested,
    monthly: plan.monthlyInvest + (change.moreMonthly ?? 0),
    stockShare: plan.stockShare,
    years: Math.max(1, retireAge - profile.age),
    goal: m.fiNumber,
    retireAge,
  };
}

/** { sunny, mixed, stormy } as shares of the 500 futures (they add to 1), the sky, and the inputs. */
export function forecast(profile, m, plan, change = {}) {
  const input = forecastInputs(profile, m, plan, change);
  if (!(input.goal > 0)) return { none: true, input };
  const sim = monteCarlo(input);
  const sunny = sim.successRate;
  const mixed = Math.max(0, sim.halfwayRate - sim.successRate);
  const stormy = Math.max(0, 1 - sim.halfwayRate);
  // The sky shows whichever outcome is most common; ties lean brighter.
  const sky = sunny >= mixed && sunny >= stormy ? "sunny" : mixed >= stormy ? "mixed" : "stormy";
  return { sunny, mixed, stormy, sky, input, expectedReturn: sim.expectedReturn, volatility: sim.volatility };
}

const of500 = (share) => Math.round(share * 500);

/** A share as a percent that never rounds a few futures down to "0%" or nearly all up to "100%". */
export function sharePct(share) {
  if (share > 0 && share < 0.005) return "under 1%";
  if (share < 1 && share > 0.995) return "over 99%";
  return pct(share);
}

/** The forecast in plain words, naming the goal, the age, and the assumptions. */
export function forecastText(f) {
  if (f.none) return "There's no spending recorded yet, so there's no goal to forecast. Finish the survey to see your weather.";
  const { input } = f;
  return (
    `We replayed 500 possible markets from today to age ${input.retireAge}. ` +
    `Sunny: ${of500(f.sunny)} of 500 (${sharePct(f.sunny)}) reach your goal of ${money(input.goal)}. ` +
    `Mixed: ${of500(f.mixed)} (${sharePct(f.mixed)}) get at least halfway, ${money(input.goal / 2)}. ` +
    `Stormy: ${of500(f.stormy)} (${sharePct(f.stormy)}) end less than halfway.`
  );
}

export function assumptionsText(f) {
  if (f.none) return "";
  return (
    `Assumes ${money(f.input.monthly)} invested a month, ${pct(f.input.stockShare)} in stocks, and about ${pct(f.expectedReturn, 1)} growth a year after inflation ` +
    `with ups and downs of around ${pct(f.volatility)}. Past markets don't guarantee future ones; this is a range, not a promise.`
  );
}

/** What could brighten the forecast: the same simulation with one change at a time. */
export function brighten(profile, m, plan) {
  const base = forecast(profile, m, plan);
  if (base.none) return [];
  return [
    { key: "more", label: "Invest $100 more a month", change: { moreMonthly: 100 } },
    { key: "later", label: "Retire 2 years later", change: { laterYears: 2 } },
  ].map((o) => {
    const f = forecast(profile, m, plan, o.change);
    return { ...o, sunny: f.sunny, stormy: f.stormy, from: base.sunny };
  });
}
