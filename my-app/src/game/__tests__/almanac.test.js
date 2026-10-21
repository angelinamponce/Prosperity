import { TIPS, tipOfTheDay } from "../tips";
import { almanacCards, daysUntilMonth, nextMilestone } from "../almanac";
import { levelInfo } from "../rules";
import { payoffLookahead } from "../garden";
import { sampleProfile } from "../../dashboard/sampleProfile";

const now = new Date(2026, 9, 21);
const plan = { extraDebt: 300, strategy: "avalanche" };

test("at least 30 distinct, short tips, none promising returns or urging spending", () => {
  expect(TIPS.length).toBeGreaterThanOrEqual(30);
  expect(new Set(TIPS).size).toBe(TIPS.length);
  for (const t of TIPS) {
    expect(t.length).toBeLessThan(160);
    expect(t).not.toMatch(/guaranteed (return|profit)|can't lose|get rich|buy now/i);
  }
});

test("one tip a day: the same all day, different the next day", () => {
  expect(tipOfTheDay(new Date(2026, 9, 21, 8))).toEqual(tipOfTheDay(new Date(2026, 9, 21, 23)));
  expect(tipOfTheDay(new Date(2026, 9, 22)).text).not.toBe(tipOfTheDay(new Date(2026, 9, 21)).text);
});

test("the next milestone is the next debt cleared on the saved plan, in days, or the next level with no debt", () => {
  const info = levelInfo(120);
  const m = nextMilestone({ debts: sampleProfile.debts, plan, info, now });
  const first = payoffLookahead(sampleProfile.debts, { ...plan, extra: 300, now }).debts.sort((a, b) => a.payoffMonth - b.payoffMonth)[0];
  expect(m.title).toBe(`${first.name} cleared`);
  expect(m.body).toContain(first.payoffDate);
  expect(m.body).toContain("on your saved plan");
  expect(daysUntilMonth(1, now)).toBe(11); // Oct 21 to Nov 1
  const none = nextMilestone({ debts: [], plan, info, now });
  expect(none).toMatchObject({ kind: "level", title: `Level ${info.level + 1}` });
  expect(none.body).toMatch(/never dollar amounts/);
});

test("four cards in order: mission, streak, milestone, tip", () => {
  const quest = { title: "Answer 5 quick questions", xp: "8–16 XP each", time: "About 3 min" };
  const cards = almanacCards({ quest, streakNow: 2, best: 4, checkedIn: false, debts: sampleProfile.debts, plan, info: levelInfo(50), now });
  expect(cards.map((c) => c.key)).toEqual(["mission", "streak", "milestone", "tip"]);
  expect(cards[1].title).toBe("2 weeks in a row");
  expect(cards[1].body).toMatch(/Check in any day this week/);
});
