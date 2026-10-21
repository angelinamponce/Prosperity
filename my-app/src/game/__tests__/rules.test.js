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

describe("missions (honor system)", () => {
  const done = (p, id = "match") => reduce(p, { type: "completeMission", id, title: "Get the match", at: 1 }, ctx).progress;
  const undo = (p, id = "match") => reduce(p, { type: "undoMission", id }, ctx).progress;

  test("completing a mission pays XP once", () => {
    const p = done(emptyProgress());
    expect(p.xp).toBe(XP.mission);
    expect(p.missions.match).toMatchObject({ done: true, xp: XP.mission });
    expect(done(p).xp).toBe(XP.mission); // completing again changes nothing
  });

  test("undo takes back exactly the XP the mission gave", () => {
    const p = undo(done({ ...emptyProgress(), xp: 100 }));
    expect(p.xp).toBe(100);
    expect(p.missions.match).toMatchObject({ done: false, xp: 0 });
  });

  test("complete, undo and redo can never farm XP", () => {
    let p = { ...emptyProgress(), xp: 100 };
    for (let i = 0; i < 5; i += 1) p = undo(done(p));
    expect(p.xp).toBe(100);
    p = done(p);
    expect(p.xp).toBe(100 + XP.mission);
  });

  test("each mission is separate, and undoing one leaves the others alone", () => {
    let p = done(done(emptyProgress(), "match"), "trim");
    expect(p.xp).toBe(2 * XP.mission);
    p = undo(p, "trim");
    expect(p.xp).toBe(XP.mission);
    expect(p.missions.match.done).toBe(true);
  });

  test("undoing a mission that isn't done does nothing", () => {
    const p = emptyProgress();
    expect(reduce(p, { type: "undoMission", id: "nope" }, ctx).progress).toBe(p);
  });

  test("old saves without missions load fine", () => {
    expect(normalizeProgress({ xp: 10 }).missions).toEqual({});
  });
});

describe("Phase 9: quiz answers teach words, befriending is remembered", () => {
  const { reduce, emptyProgress, XP } = require("../rules");
  const ans = (over = {}) => ({ type: "answerQuestion", id: "d1", topic: "debt", difficulty: 1, correct: true, assists: {}, term: "apr", termTitle: "APR", at: 1000, ...over });

  test("a first right answer learns its word once, with the usual word XP", () => {
    const a = reduce(emptyProgress(), ans());
    expect(a.progress.terms.apr).toBe(true);
    expect(a.events.filter((e) => e.type === "xp").map((e) => e.label)).toContain('You learned "APR"');
    const b = reduce(a.progress, ans({ id: "d2", at: 2000 }));
    expect(b.events.some((e) => e.label === 'You learned "APR"')).toBe(false);
  });

  test("a wrong answer doesn't learn the word", () => {
    expect(reduce(emptyProgress(), ans({ correct: false })).progress.terms.apr).toBeUndefined();
  });

  test("befriending is saved, counted, announced once, and earns no extra XP", () => {
    const a = reduce(emptyProgress(), { type: "befriend", id: "minimum-mite", name: "Minimum Mite", at: 5 });
    expect(a.progress.quiz.befriended["minimum-mite"]).toEqual({ first: 5, times: 1 });
    expect(a.events).toEqual([{ type: "befriended", id: "minimum-mite", name: "Minimum Mite" }]);
    expect(a.progress.xp).toBe(0);
    const b = reduce(a.progress, { type: "befriend", id: "minimum-mite", name: "Minimum Mite", at: 9 });
    expect(b.progress.quiz.befriended["minimum-mite"]).toEqual({ first: 5, times: 2 });
    expect(b.events).toEqual([]);
    expect(XP.termLearned).toBe(10);
  });
});

describe("Phase 9b: Greenhouse keeper challenges", () => {
  const { reduce, emptyProgress, KEEPER, BADGES } = require("../rules");
  const result = (p, firstTry, at = 1) => reduce(p, { type: "keeperResult", topic: "debt", firstTry, total: KEEPER.questions, at });

  test("4 of 6 on the first try passes and earns that greenhouse's badge, once", () => {
    const a = result(emptyProgress(), 4);
    expect(a.progress.quiz.keepers.debt).toEqual({ best: 4, tries: 1, passedAt: 1, last: 4 });
    expect(a.progress.badges["keeper-debt"]).toBeTruthy();
    expect(a.events.some((e) => e.type === "badge" && e.badge.id === "keeper-debt")).toBe(true);
    const b = result(a.progress, 6, 2);
    expect(b.progress.quiz.keepers.debt).toMatchObject({ best: 6, tries: 2, passedAt: 1 });
    expect(b.events.some((e) => e.type === "badge")).toBe(false);
  });

  test("a miss costs nothing: no badge, best score kept, and a later lower score never lowers it", () => {
    const a = result(emptyProgress(), 3);
    expect(a.progress.quiz.keepers.debt).toEqual({ best: 3, tries: 1, passedAt: null, last: 3 });
    expect(a.progress.badges["keeper-debt"]).toBeUndefined();
    expect(a.progress.xp).toBe(0);
    const b = result(a.progress, 1, 2);
    expect(b.progress.quiz.keepers.debt.best).toBe(3);
    // Passing later, and then doing worse, keeps the badge.
    const c = result(result(b.progress, 5, 3).progress, 0, 4);
    expect(c.progress.badges["keeper-debt"]).toBeTruthy();
    expect(c.progress.quiz.keepers.debt.passedAt).toBe(3);
  });

  test("one badge per greenhouse, each explaining exactly what it takes", () => {
    const keeperBadges = BADGES.filter((b) => b.id.startsWith("keeper-"));
    expect(keeperBadges.map((b) => b.id)).toEqual(["keeper-budgeting", "keeper-debt", "keeper-saving", "keeper-investing"]);
    for (const b of keeperBadges) expect(b.how).toContain("4 of 6 right on the first try");
  });
});
