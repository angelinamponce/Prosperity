import { pickQuest } from "../quest";
import { XP, emptyProgress, reduce } from "../rules";

const recs = [
  { id: "match", title: "Get your full 401(k) match", because: "You contribute 3%.", impact: "+$1,560/yr free", page: "invest", habit: "I raised my contribution" },
  { id: "trim", title: "Put some flexible spending to work", because: "About $500/mo is flexible.", impact: "10% = $600/yr", page: "cash-flow", habit: "I picked one expense to trim" },
];
const words = [
  { key: "apr", title: "APR", explain: "Annual percentage rate." },
  { key: "budget", title: "Budget", explain: "A plan for your money." },
];
const now = new Date(2026, 9, 20, 15, 0).getTime();
const base = { fromSurvey: true, recs, words, dueCount: 10, now };
const missionsDone = (p) => ({ ...p, missions: { match: { done: true, xp: XP.mission }, trim: { done: true, xp: XP.mission } } });

test("before the survey, the quest is always to finish it", () => {
  const q = pickQuest({ ...base, fromSurvey: false, progress: emptyProgress() });
  expect(q).toMatchObject({ kind: "survey", xp: `+${XP.surveyDone} XP`, action: { to: "/signup" } });
});

test("then the first unfinished mission, with its honor-system habit", () => {
  const q = pickQuest({ ...base, progress: emptyProgress() });
  expect(q).toMatchObject({ kind: "mission", title: "Get your full 401(k) match", xp: `+${XP.mission} XP`, mission: { id: "match" } });
  const p = { ...emptyProgress(), missions: { match: { done: true, xp: XP.mission } } };
  expect(pickQuest({ ...base, progress: p }).mission.id).toBe("trim");
});

test("then a quick quiz, but only once a day", () => {
  const p = missionsDone(emptyProgress());
  expect(pickQuest({ ...base, progress: p }).kind).toBe("quiz");
  const quizzed = reduce(p, { type: "answerQuestion", id: "x", topic: "debt", difficulty: 1, correct: true, at: now - 3600000 }).progress;
  expect(pickQuest({ ...base, progress: quizzed }).kind).toBe("word");
  const yesterday = reduce(p, { type: "answerQuestion", id: "x", topic: "debt", difficulty: 1, correct: true, at: now - 86400000 }).progress;
  expect(pickQuest({ ...base, progress: yesterday }).kind).toBe("quiz");
  expect(pickQuest({ ...base, dueCount: 0, progress: p }).kind).toBe("word");
});

test("then an unlearned money word, which can be learned right in the card", () => {
  const p = { ...missionsDone(emptyProgress()), terms: { apr: true } };
  const q = pickQuest({ ...base, dueCount: 0, progress: p });
  expect(q).toMatchObject({ kind: "word", title: "Learn a money word: Budget", action: { learn: "budget" }, xp: `+${XP.termLearned} XP` });
});

test("and when everything's done, there's always a quick battle", () => {
  const p = { ...missionsDone(emptyProgress()), terms: { apr: true, budget: true } };
  expect(pickQuest({ ...base, dueCount: 0, progress: p })).toMatchObject({ kind: "battle", action: { page: "battle" } });
});

test("every quest states its reward and time", () => {
  const states = [
    { fromSurvey: false, progress: emptyProgress() },
    { progress: emptyProgress() },
    { progress: missionsDone(emptyProgress()) },
    { dueCount: 0, progress: missionsDone(emptyProgress()) },
    { dueCount: 0, words: [], progress: missionsDone(emptyProgress()) },
  ];
  for (const s of states) {
    const q = pickQuest({ ...base, ...s });
    expect(q.xp).toMatch(/XP/);
    expect(q.time).toMatch(/min/);
    expect(q.action.label).toBeTruthy();
  }
});
