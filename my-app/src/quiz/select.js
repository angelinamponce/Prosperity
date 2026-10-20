// Picks which questions to ask next. Pure, with a seeded random source so tests are repeatable.

import { isDue } from "../game/rules";

// Small seeded RNG (same family as the market simulation's).
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The difficulty that suits a level: Starter questions first, Stretch ones once you've grown. */
export const targetDifficulty = (level) => (level <= 2 ? 1 : level <= 5 ? 2 : 3);

const RECENT_MS = 15 * 60 * 1000;

/**
 * Scores every question and returns the best `count`.
 * Favors, in order: due or new questions, topics the player has missed, a difficulty that fits their level.
 * Questions answered in the last 15 minutes rest unless nothing else is left.
 * With no topic given, a gentle penalty spreads one session across topics.
 */
export function selectQuestions(bank, quiz, { count = 5, topic = null, level = 1, now = Date.now(), rng = Math.random, exclude = [] } = {}) {
  const target = targetDifficulty(level);
  const pool = bank.filter((q) => (!topic || q.topic === topic) && !exclude.includes(q.id));

  const scored = pool.map((q) => {
    const s = quiz.q[q.id];
    let score = 0;
    if (!s) score += 2; // new
    else if (isDue(s, now)) score += 3 + Math.min(2, (now - s.due) / 86400000 / 7); // due, a bit more if overdue
    else score -= 4; // still resting
    if (s && now - s.last < RECENT_MS) score -= 3;
    const t = quiz.topics[q.topic];
    const accuracy = t ? (t.correct + 1) / (t.seen + 2) : 0.5; // smoothed so one answer doesn't swing it
    score += (1 - accuracy) * 2;
    score -= Math.abs(q.difficulty - target) * 0.75;
    score += rng() * 0.6;
    return { q, score };
  });

  const picked = [];
  const perTopic = {};
  while (picked.length < count && scored.length) {
    let best = 0;
    for (let i = 1; i < scored.length; i += 1) {
      const adj = (x) => x.score - (topic ? 0 : (perTopic[x.q.topic] ?? 0) * 0.9);
      if (adj(scored[i]) > adj(scored[best])) best = i;
    }
    const [{ q }] = scored.splice(best, 1);
    picked.push(q);
    perTopic[q.topic] = (perTopic[q.topic] ?? 0) + 1;
  }
  return picked;
}

/** How many questions are due or new, per topic, for the topic cards. */
export function dueCounts(bank, quiz, now = Date.now()) {
  const out = {};
  for (const q of bank) {
    const s = quiz.q[q.id];
    if (isDue(s, now)) out[q.topic] = (out[q.topic] ?? 0) + 1;
  }
  return out;
}
