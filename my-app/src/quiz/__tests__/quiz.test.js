import { BANK } from "../bank";
import { TEMPLATES } from "../templates";
import { TOPICS } from "../topics";
import { seededRandom, selectQuestions, targetDifficulty } from "../select";
import { answer, askSprout, currentQuestion, next, resolveQuestion, startSession, summary, takeHint } from "../session";
import { GLOSSARY } from "../../dashboard/glossary";
import { sampleProfile } from "../../dashboard/sampleProfile";
import { profileFromRows } from "../../dashboard/profileFromRows";
import { computeMetrics, growthSeries } from "../../dashboard/finance";
import { QUIZ_TOPICS, emptyProgress, isDue, quizXp, reduce } from "../../game/rules";

const ctxFor = (profile) => ({ profile, metrics: computeMetrics(profile) });
const PROFILES = {
  sample: ctxFor(sampleProfile),
  // A survey user with no debt and nothing saved.
  noDebt: ctxFor(profileFromRows({ user: { name: "Sam" }, income: { annual_income: 42000 }, savings: null, spending: { rent_utilities: 1200, groceries_food: 80 } })),
  // A survey user whose spending is more than their income.
  stretched: ctxFor(profileFromRows({ user: { name: "Lee" }, income: { annual_income: 24000 }, savings: null, spending: { rent_utilities: 2100, debt_left: 4000, debt_payment: 60, debt_interest: 0.27 } })),
};

describe("question bank", () => {
  test("has 48 questions, 12 per topic, 13 of them built from the player's own numbers", () => {
    expect(BANK).toHaveLength(48);
    for (const t of QUIZ_TOPICS) expect(BANK.filter((q) => q.topic === t)).toHaveLength(12);
    expect(BANK.filter((q) => q.template)).toHaveLength(13);
    for (const t of QUIZ_TOPICS) expect(BANK.filter((q) => q.topic === t && q.template).length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(TOPICS).sort()).toEqual([...QUIZ_TOPICS].sort());
  });

  test("every question is complete and links to a real money word", () => {
    const ids = new Set();
    for (const q of BANK) {
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
      expect([1, 2, 3]).toContain(q.difficulty);
      expect(GLOSSARY[q.term]).toBeDefined();
      expect(q.hint).toBeTruthy();
    }
    // Template questions get their text from a template; the rest are written out in full.
    for (const q of BANK.filter((x) => x.template)) expect(TEMPLATES[q.template]).toBeDefined();
    for (const q of BANK.filter((x) => !x.template)) {
      expect(q.prompt).toBeTruthy();
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.correct).toBe(0);
      expect(q.explain.length).toBeGreaterThan(40);
    }
  });

  test("no question promises guaranteed returns", () => {
    const text = BANK.map((q) => [q.prompt, q.explain, ...(q.choices ?? [])].join(" ")).join(" ");
    // "guarantee" only appears in wrong choices or in sentences saying returns aren't guaranteed.
    for (const q of BANK.filter((x) => !x.template)) {
      const right = q.choices[q.correct];
      expect(right).not.toMatch(/guarantee(d|s)? (a )?(profit|return)/i);
    }
    expect(text).not.toMatch(/get rich quick/i);
  });
});

describe("templates built from the player's numbers", () => {
  for (const [who, ctx] of Object.entries(PROFILES)) {
    test(`all templates give a fair question for the ${who} profile`, () => {
      for (const [key, build] of Object.entries(TEMPLATES)) {
        const t = build(ctx);
        expect(t).toBeTruthy();
        expect(t.choices).toHaveLength(4);
        expect(new Set(t.choices).size).toBe(4);
        expect(t.choices[t.correct]).toBeTruthy();
        expect(t.explain).toBeTruthy();
        expect(t.prompt).not.toMatch(/NaN|undefined|Infinity/);
        expect(t.explain).not.toMatch(/NaN|undefined|Infinity/);
        expect(key).toBeTruthy();
      }
      expect(TEMPLATES.contributionsVsGrowth(ctx).assumption).toMatch(/not a promise/i);
    });
  }

  test("uses real numbers when they exist and example numbers when they don't", () => {
    expect(TEMPLATES.monthlyInterest(PROFILES.sample).example).toBe(false);
    expect(TEMPLATES.monthlyInterest(PROFILES.noDebt).example).toBe(true);
    expect(TEMPLATES.savingsRate(PROFILES.stretched).example).toBe(true); // nothing left over
    expect(TEMPLATES.emergencyTarget(PROFILES.noDebt).example).toBe(false);
  });

  test("the math is right", () => {
    // Highest-APR sample debt: credit card, $3,200 at 22.9% -> about $61 a month.
    const mi = TEMPLATES.monthlyInterest(PROFILES.sample);
    expect(mi.choices[mi.correct]).toBe("$61");
    const g = TEMPLATES.contributionsVsGrowth();
    const expected = Math.round(growthSeries(0, 200, 0.055, 30)[30] / 1000) * 1000;
    expect(g.choices[g.correct]).toBe(`About $${expected.toLocaleString("en-US")}`);
    const m = PROFILES.noDebt.metrics;
    const et = TEMPLATES.emergencyTarget(PROFILES.noDebt);
    expect(et.choices[et.correct]).toBe(`$${Math.round(m.essential * 3).toLocaleString("en-US")}`);
  });
});

describe("resolveQuestion", () => {
  test("shuffles choices but keeps track of the right one, the same way each time", () => {
    for (const q of BANK) {
      const a = resolveQuestion(q, PROFILES.sample, 7);
      const b = resolveQuestion(q, PROFILES.sample, 7);
      expect(a.choices).toEqual(b.choices);
      const original = q.template ? TEMPLATES[q.template](PROFILES.sample) : q;
      expect(a.choices[a.correct]).toBe(original.choices[original.correct]);
    }
  });

  test("the right answer isn't always in the same spot", () => {
    const spots = new Set(BANK.map((q) => resolveQuestion(q, PROFILES.sample, 1).correct));
    expect(spots.size).toBe(4);
  });
});

describe("selectQuestions", () => {
  const quiz = emptyProgress().quiz;
  const opts = (extra) => ({ count: 5, level: 1, now: 1e12, rng: seededRandom(3), ...extra });

  test("returns distinct questions and respects a chosen topic", () => {
    const qs = selectQuestions(BANK, quiz, opts({ topic: "debt" }));
    expect(qs).toHaveLength(5);
    expect(new Set(qs.map((q) => q.id)).size).toBe(5);
    expect(qs.every((q) => q.topic === "debt")).toBe(true);
  });

  test("a mixed quiz spreads across topics", () => {
    const qs = selectQuestions(BANK, quiz, opts());
    expect(new Set(qs.map((q) => q.topic)).size).toBeGreaterThanOrEqual(3);
  });

  test("beginners get mostly Starter questions; higher levels get harder ones", () => {
    expect(targetDifficulty(1)).toBe(1);
    const easy = selectQuestions(BANK, quiz, opts({ topic: "saving" }));
    expect(easy.filter((q) => q.difficulty === 1).length).toBeGreaterThanOrEqual(2);
    const hard = selectQuestions(BANK, quiz, opts({ topic: "saving", level: 8 }));
    expect(hard.filter((q) => q.difficulty === 3).length).toBeGreaterThanOrEqual(2);
  });

  test("prefers topics the player has missed, and rests questions answered recently", () => {
    const now = 1e12;
    let p = emptyProgress();
    for (const q of BANK.filter((x) => x.topic === "saving")) {
      p = reduce(p, { type: "answerQuestion", ...q, correct: true, at: now - 60000 }).progress;
    }
    for (const q of BANK.filter((x) => x.topic === "debt").slice(0, 3)) {
      p = reduce(p, { type: "answerQuestion", ...q, correct: false, at: now - 3600000 }).progress;
    }
    const qs = selectQuestions(BANK, p.quiz, opts({ now, count: 6 }));
    expect(qs.some((q) => q.topic === "saving")).toBe(false);
    expect(qs.filter((q) => q.topic === "debt").length).toBeGreaterThanOrEqual(2);
  });
});

describe("session", () => {
  const items = BANK.filter((q) => q.topic === "budgeting" && !q.template).slice(0, 4).map((q) => resolveQuestion(q, PROFILES.sample, 1));

  test("a wrong answer comes back later, once; a right one doesn't", () => {
    let s = startSession(items);
    const first = currentQuestion(s);
    s = answer(s, (first.correct + 1) % 4);
    expect(s.last).toMatchObject({ correct: false, comingBack: true });
    expect(s.queue.filter((id) => id === first.id)).toHaveLength(2);
    s = next(s);
    while (currentQuestion(s).id !== first.id) {
      s = next(answer(s, currentQuestion(s).correct));
    }
    s = answer(s, (first.correct + 1) % 4); // wrong again: not re-queued a third time
    expect(s.last.comingBack).toBe(false);
    s = next(s);
    expect(s.phase).toBe("done");
    const sum = summary(s);
    expect(sum.total).toBe(4);
    expect(sum.correct).toBe(3);
  });

  test("Ask Sprout rules out one wrong answer, which can't then be picked", () => {
    let s = startSession(items);
    s = askSprout(s);
    const q = currentQuestion(s);
    const out = s.eliminated[q.id];
    expect(out).not.toBe(q.correct);
    expect(askSprout(s)).toBe(s);
    expect(answer(s, out)).toBe(s);
  });

  test("help is recorded with the answer so XP can be adjusted", () => {
    let s = takeHint(askSprout(startSession(items)));
    s = answer(s, currentQuestion(s).correct);
    expect(s.last.assists).toEqual({ hint: true, sprout: true });
  });
});

describe("quiz XP rules", () => {
  const q = { id: "x", topic: "debt", difficulty: 2 };

  test("XP by difficulty, reduced (never negative) with help", () => {
    expect(quizXp(1)).toBe(8);
    expect(quizXp(2)).toBe(12);
    expect(quizXp(3)).toBe(16);
    expect(quizXp(2, { hint: true })).toBe(9);
    expect(quizXp(2, { hint: true, sprout: true })).toBe(6);
  });

  test("full XP only when a question is new or due, so it can't be farmed", () => {
    const now = 1e12;
    let { progress, events } = reduce(emptyProgress(), { type: "answerQuestion", ...q, correct: true, at: now });
    expect(events.find((e) => e.type === "xp" && e.label === "Correct answer").amount).toBe(12);
    const xpAfterFirst = progress.xp;
    ({ progress } = reduce(progress, { type: "answerQuestion", ...q, correct: true, at: now + 1000 }));
    expect(progress.xp).toBe(xpAfterFirst);
    expect(isDue(progress.quiz.q.x, now + 86400000 + 1)).toBe(true);
  });

  test("a wrong answer costs nothing and makes the question due right away", () => {
    const now = 1e12;
    const { progress, events } = reduce(emptyProgress(), { type: "answerQuestion", ...q, correct: false, at: now });
    expect(progress.xp).toBe(0);
    expect(events).toHaveLength(0);
    expect(progress.quiz.q.x).toMatchObject({ box: 0, seen: 1, correct: 0 });
    expect(isDue(progress.quiz.q.x, now)).toBe(true);
  });

  test("Good Question and Well Rounded badges", () => {
    let p = emptyProgress();
    p = reduce(p, { type: "answerQuestion", ...q, correct: true, at: 1 }).progress;
    expect(p.badges["good-question"]).toBeTruthy();
    for (const topic of QUIZ_TOPICS) p = reduce(p, { type: "answerQuestion", id: `y-${topic}`, topic, difficulty: 1, correct: true, at: 2 }).progress;
    expect(p.badges["well-rounded"]).toBeTruthy();
  });
});
