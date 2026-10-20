import {
  BADGES,
  LEVEL_XP,
  START_FREEZES,
  XP,
  applyCheckIn,
  currentStreak,
  emptyProgress,
  levelInfo,
  normalizeProgress,
  reduce,
  weekNumber,
} from "../rules";

const TERMS = Array.from({ length: 12 }, (_, i) => `t${i}`);
const ctx = { termKeys: TERMS };
const run = (actions, start = emptyProgress()) =>
  actions.reduce(
    (acc, a) => {
      const res = reduce(acc.progress, a, ctx);
      return { progress: res.progress, events: [...acc.events, ...res.events] };
    },
    { progress: start, events: [] }
  );

describe("levels and stages", () => {
  test("starts as a level 1 seed", () => {
    const info = levelInfo(0);
    expect(info.level).toBe(1);
    expect(info.stage.key).toBe("seed");
    expect(info.toNext).toBe(LEVEL_XP[1]);
  });

  test("grows a stage every two levels and tops out", () => {
    expect(levelInfo(LEVEL_XP[2]).stage.key).toBe("sprout"); // level 3
    expect(levelInfo(LEVEL_XP[4]).stage.key).toBe("sapling"); // level 5
    const top = levelInfo(99999);
    expect(top.maxed).toBe(true);
    expect(top.stage.key).toBe("tree");
    expect(top.progress).toBe(1);
  });

  test("the next stage's XP matches where the stage actually changes", () => {
    const info = levelInfo(0);
    expect(levelInfo(info.nextStageXp).stageIndex).toBe(1);
    expect(levelInfo(info.nextStageXp - 1).stageIndex).toBe(0);
  });
});

describe("reduce", () => {
  test("learning the same word twice only pays once", () => {
    const { progress } = run([
      { type: "learnTerm", key: "apr", title: "APR" },
      { type: "learnTerm", key: "apr", title: "APR" },
    ]);
    expect(progress.xp).toBe(XP.termLearned);
    expect(Object.keys(progress.terms)).toEqual(["apr"]);
  });

  test("survey, tour and check-in each pay once and unlock their badges", () => {
    const week = 3000;
    const { progress, events } = run([
      { type: "surveyDone" },
      { type: "surveyDone" },
      { type: "tourDone" },
      { type: "checkIn", week },
      { type: "checkIn", week },
    ]);
    expect(progress.badges["first-seed"]).toBeTruthy();
    expect(progress.badges["tour-guide"]).toBeTruthy();
    expect(progress.badges["first-checkin"]).toBeTruthy();
    expect(progress.xp).toBe(XP.surveyDone + XP.tourDone + XP.checkIn + 3 * XP.badge);
    expect(events.filter((e) => e.type === "badge")).toHaveLength(3);
  });

  test("five words earn Curious Mind, all words earn Word Collector", () => {
    const keys = Array.from({ length: 12 }, (_, i) => `t${i}`);
    const five = run(keys.slice(0, 5).map((key) => ({ type: "learnTerm", key })));
    expect(five.progress.badges["curious-mind"]).toBeTruthy();
    expect(five.progress.badges["word-collector"]).toBeUndefined();
    const all = run(keys.map((key) => ({ type: "learnTerm", key })));
    expect(all.progress.badges["word-collector"]).toBeTruthy();
  });

  test("reports level ups and stage ups", () => {
    const start = { ...emptyProgress(), xp: LEVEL_XP[2] - 5 }; // just short of level 3 (Sprout)
    const { events } = run([{ type: "learnTerm", key: "apr" }], start);
    expect(events.some((e) => e.type === "levelUp" && e.level === 3)).toBe(true);
    expect(events.find((e) => e.type === "stageUp")).toMatchObject({ from: { key: "seed" }, to: { key: "sprout" } });
  });

  test("an unknown action changes nothing", () => {
    const p = emptyProgress();
    expect(reduce(p, { type: "spendMoney" }, ctx)).toEqual({ progress: p, events: [] });
  });

  test("no badge depends on money", () => {
    // Every badge is decided by game progress alone, so it can't reward spending or pressure saving.
    expect(BADGES.map((b) => b.earned.toString()).join(" ")).not.toMatch(/income|spend|debt|savings|balance/i);
  });
});

describe("weekly streak", () => {
  const fresh = emptyProgress().streak;

  test("counts consecutive weeks and ignores repeat visits", () => {
    let s = applyCheckIn(fresh, 100).streak;
    s = applyCheckIn(s, 100).streak;
    s = applyCheckIn(s, 101).streak;
    expect(s.count).toBe(2);
    expect(s.total).toBe(2);
  });

  test("a missed week is covered by a freeze automatically", () => {
    let s = applyCheckIn(fresh, 100).streak;
    const res = applyCheckIn(s, 102);
    s = res.streak;
    expect(s.count).toBe(2);
    expect(s.freezes).toBe(START_FREEZES - 1);
    expect(res.events.map((e) => e.type)).toContain("freezeUsed");
  });

  test("a long break starts fresh with a welcome, never below one week", () => {
    let s = applyCheckIn(fresh, 100).streak;
    s = applyCheckIn(s, 101).streak;
    const res = applyCheckIn(s, 120);
    expect(res.streak.count).toBe(1);
    expect(res.streak.best).toBe(2);
    expect(res.events.map((e) => e.type)).toContain("welcomeBack");
  });

  test("earns a freeze every four check-ins, up to the cap", () => {
    let s = { ...fresh, freezes: 0 };
    for (let w = 0; w < 8; w += 1) s = applyCheckIn(s, 200 + w).streak;
    expect(s.freezes).toBe(2);
  });

  test("the current streak stays alive through a gap freezes can cover", () => {
    const s = applyCheckIn(fresh, 100).streak;
    expect(currentStreak(s, 101)).toBe(1);
    expect(currentStreak(s, 100 + START_FREEZES + 1)).toBe(1);
    expect(currentStreak(s, 100 + START_FREEZES + 2)).toBe(0);
  });

  test("weeks start on Monday", () => {
    const sunday = new Date(2026, 9, 18);
    const monday = new Date(2026, 9, 19);
    expect(weekNumber(monday) - weekNumber(sunday)).toBe(1);
    expect(weekNumber(new Date(2026, 9, 25))).toBe(weekNumber(monday));
  });
});

describe("normalizeProgress", () => {
  test("survives missing or damaged saves", () => {
    expect(normalizeProgress(null)).toEqual(emptyProgress());
    expect(normalizeProgress("oops")).toEqual(emptyProgress());
    const p = normalizeProgress({ xp: -5, terms: [], streak: { count: 3 }, settings: { sound: true } });
    expect(p.xp).toBe(0);
    expect(p.terms).toEqual({});
    expect(p.streak.count).toBe(3);
    expect(p.streak.freezes).toBe(START_FREEZES);
    expect(p.settings).toEqual({ view: "classic", sound: true, instantText: false, speedRound: false });
    expect(p.quiz).toEqual({ q: {}, topics: {}, befriended: {}, keepers: {} });
  });
});
