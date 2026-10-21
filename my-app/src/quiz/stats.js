// Quiz stats for the player: per topic, how often they're right, which questions they've "got down"
// (answered right on 3 spaced reviews in a row), what's ready to practice now, and when the next
// review comes up. Reads the same saved progress as the quiz and battles.

import { QUIZ_TOPICS, isDue } from "../game/rules";

// Review box 3 means three right answers in a row, each after a longer rest (1, 3 and 7 days).
export const GOT_DOWN_BOX = 3;

export function quizStats(bank, quiz, now = Date.now()) {
  const topics = QUIZ_TOPICS.map((topic) => {
    const qs = bank.filter((q) => q.topic === topic);
    const t = quiz.topics[topic] ?? { seen: 0, correct: 0 };
    const states = qs.map((q) => quiz.q[q.id]);
    return {
      topic,
      total: qs.length,
      tried: states.filter(Boolean).length,
      answers: t.seen,
      correct: t.correct,
      accuracy: t.seen ? t.correct / t.seen : null,
      gotDown: states.filter((s) => s && s.box >= GOT_DOWN_BOX).length,
      dueNow: states.filter((s) => s && isDue(s, now)).length,
      fresh: states.filter((s) => !s).length,
    };
  });
  const upcoming = Object.values(quiz.q)
    .map((s) => s.due)
    .filter((d) => d > now)
    .sort((a, b) => a - b);
  const sum = (k) => topics.reduce((a, t) => a + t[k], 0);
  return {
    topics,
    total: bank.length,
    tried: sum("tried"),
    gotDown: sum("gotDown"),
    dueNow: sum("dueNow"),
    nextReview: upcoming[0] ?? null,
  };
}
