import { GOT_DOWN_BOX, quizStats } from "../stats";
import { BANK } from "../bank";
import { emptyProgress, reduce } from "../../game/rules";

const DAY = 86400000;
const answer = (p, q, correct, at) => reduce(p, { type: "answerQuestion", id: q.id, topic: q.topic, difficulty: q.difficulty, correct, assists: {}, at }).progress;

test("a fresh player: nothing tried, everything new, no reviews scheduled", () => {
  const s = quizStats(BANK, emptyProgress().quiz, 0);
  expect(s).toMatchObject({ total: 48, tried: 0, gotDown: 0, dueNow: 0, nextReview: null });
  expect(s.topics.every((t) => t.fresh === 12 && t.accuracy === null)).toBe(true);
});

test("right answers on spaced reviews move a question to 'got down'; the next review date is tracked", () => {
  const q = BANK.find((x) => x.topic === "debt");
  let p = emptyProgress();
  let t = 1000;
  for (let i = 0; i < GOT_DOWN_BOX; i += 1) {
    p = answer(p, q, true, t);
    t = p.quiz.q[q.id].due; // come back exactly when it's due
  }
  const s = quizStats(BANK, p.quiz, t - 1);
  const debt = s.topics.find((x) => x.topic === "debt");
  expect(debt).toMatchObject({ tried: 1, gotDown: 1, correct: GOT_DOWN_BOX, answers: GOT_DOWN_BOX, accuracy: 1 });
  expect(s.nextReview).toBe(p.quiz.q[q.id].due);
  // A wrong answer sends it back to the start, and it's ready again right away.
  const after = answer(p, q, false, t + DAY);
  const s2 = quizStats(BANK, after.quiz, t + DAY);
  expect(s2.topics.find((x) => x.topic === "debt")).toMatchObject({ gotDown: 0, dueNow: 1 });
});
