// The Garden Almanac: a small card widget on the touch screen in Garden mode. Four cards the player
// flips through (nothing moves on its own): the next mission, the streak, the next milestone, and
// today's Sprout tip. Pure, so each card's wording is easy to test.

import { payoffLookahead } from "./garden";
import { tipOfTheDay } from "./tips";

const DAY_MS = 86400000;

/** Whole days from `now` to the first of the month `months` ahead (when a payoff month begins). */
export function daysUntilMonth(months, now = new Date()) {
  const target = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return Math.max(0, Math.round((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY_MS));
}

/**
 * The next milestone: the next debt cleared on the saved plan (with roughly how many days away), or,
 * with no debt, the next level. Never a dollar target.
 */
export function nextMilestone({ debts, plan, info, now = new Date() }) {
  const ahead = payoffLookahead(debts, { extra: plan.extraDebt, strategy: plan.strategy, now });
  const next = ahead.debts.filter((d) => d.payoffMonth != null).sort((a, b) => a.payoffMonth - b.payoffMonth)[0];
  if (next) {
    const days = daysUntilMonth(next.payoffMonth, now);
    return { kind: "debt", title: `${next.name} cleared`, body: `About ${days.toLocaleString("en-US")} days away: ${next.payoffDate}, on your saved plan.` };
  }
  if (info.maxed) return { kind: "level", title: "Top level reached", body: "Sprout is fully grown. Keep the habits going!" };
  return { kind: "level", title: `Level ${info.level + 1}`, body: `${info.toNext} XP to go. Learning and habits earn XP, never dollar amounts.` };
}

/** The four cards, in order. */
export function almanacCards({ quest, streakNow, best, checkedIn, debts, plan, info, now = new Date() }) {
  const milestone = nextMilestone({ debts, plan, info, now });
  const tip = tipOfTheDay(now);
  return [
    { key: "mission", label: "Next mission", title: quest.title, body: `${quest.xp} · ${quest.time}` },
    {
      key: "streak",
      label: "Streak",
      title: `${streakNow} ${streakNow === 1 ? "week" : "weeks"} in a row`,
      body: `${checkedIn ? "Checked in this week." : "Check in any day this week to keep it going."} Best: ${best}.`,
    },
    { key: "milestone", label: "Next milestone", title: milestone.title, body: milestone.body },
    { key: "tip", label: "Today's Sprout tip", title: `Tip ${tip.n}`, body: tip.text },
  ];
}
