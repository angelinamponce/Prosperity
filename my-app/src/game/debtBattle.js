// The debt battle: one encounter per debt, in the order the plan pays them. A Debt Blob's health is
// the months until that debt is gone on the plan being shown, measured against paying only the
// minimums. "Damage" is months saved by a what-if; the real balance never changes here, because the
// app can't see payments. Only a debt the survey shows at $0 counts as a real victory.

import { HIGH_INTEREST_APR, addMonths, simulatePayoff } from "../dashboard/finance";
import { money, pct } from "../design/format";
import { payoffLookahead } from "./garden";

const NEVER = 600;

/** The debts with a balance, in the order the strategy sends extra money to them. */
export function encounterOrder(debts, strategy = "avalanche") {
  const owed = debts.filter((d) => d.balance > 0);
  return [...owed].sort(strategy === "snowball" ? (a, b) => a.balance - b.balance : (a, b) => b.apr - a.apr);
}

/**
 * Per-debt outlook for a plan: { [name]: { months, date } } (months null if it never clears), plus the
 * whole plan's debt-free months/date and total interest.
 */
export function debtOutlook(debts, { extra = 0, strategy = "avalanche", now = new Date() } = {}) {
  const ahead = payoffLookahead(debts, { extra, strategy, now });
  const owed = debts.filter((d) => d.balance > 0);
  const run = owed.length ? simulatePayoff(owed, { extra, strategy }) : null;
  return {
    byName: Object.fromEntries(ahead.debts.map((d) => [d.name, { months: d.payoffMonth, date: d.payoffDate }])),
    months: ahead.months,
    date: ahead.date,
    interest: run ? run.interest : 0,
  };
}

/** Paying only the minimums, with no rollover: each debt on its own, for the health bar's full length. */
export function minimumsOnly(debts, now = new Date()) {
  const owed = debts.filter((d) => d.balance > 0);
  if (!owed.length) return {};
  const run = simulatePayoff(owed, { extra: 0, rollover: false });
  return Object.fromEntries(
    run.payoffOrder.map((d) => [d.name, d.month != null && d.month < NEVER ? { months: d.month, date: addMonths(now, d.month) } : { months: null, date: null }])
  );
}

/**
 * The health bar: how much of the minimums-only time is still left on the plan shown, from 0 to 1.
 * When the minimums never clear the debt, the saved plan's months stand in as the full bar.
 */
export function healthFraction(shownMonths, minMonths, savedMonths) {
  if (shownMonths == null) return 1;
  const full = minMonths ?? Math.max(savedMonths ?? 0, shownMonths, 1);
  return Math.max(0.04, Math.min(1, shownMonths / full));
}

/** Sprout's hint for this debt: plain, honest, and never a push to pay more than is comfortable. */
export function sproutHint(debt, { m, plan, order }) {
  const first = order[0]?.name === debt.name;
  const high = debt.apr >= HIGH_INTEREST_APR;
  const room = Math.max(0, m.surplus - plan.extraDebt);
  const lines = [];
  if (high) lines.push(`At ${pct(debt.apr, 1)} APR, this one costs about ${money((debt.balance * debt.apr) / 12)} in interest this month, so every extra dollar here saves the most.`);
  else lines.push(`At ${pct(debt.apr, 1)} APR, this is a lower-cost debt. Paying its minimum on time keeps it shrinking steadily.`);
  if (first) lines.push(`Your plan sends extra money here first (${plan.strategy === "snowball" ? "smallest balance first" : "highest interest first"}). Once it's gone, that money rolls on to the next debt.`);
  if (m.surplus <= 0) lines.push("Right now the month doesn't leave money spare, and that's okay. Minimums first; extra can come later.");
  else if (room > 0) lines.push(`After bills, minimums and your current ${money(plan.extraDebt)} extra, about ${money(room)} a month is left. Only plan extra you can keep paying, and keep a small emergency cushion too.`);
  else lines.push("Your plan already uses all of this month's spare money. Keeping a small emergency cushion matters too.");
  return lines.join(" ");
}

/**
 * Debts the player's own survey once showed and now shows at $0 (or gone), not yet celebrated.
 * Sample numbers never count, so switching from the sample to real numbers can't fake a victory.
 */
export function newlyCleared(progress, profile) {
  if (!profile.fromSurvey) return [];
  const owed = new Set(profile.debts.filter((d) => d.balance > 0).map((d) => d.name));
  return Object.keys(progress.debts.seen).filter((name) => !owed.has(name) && !progress.debts.cleared[name]);
}
