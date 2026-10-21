// One quiz session, independent of how it's shown. The Classic quiz page and Quiz Battles both run on
// this, so they share questions, hints, re-queuing and scoring. Every function returns a new state.

import { TEMPLATES } from "./templates";
import { hashString, seededRandom } from "./select";

/**
 * Turns a bank entry into a ready-to-show question: fills template numbers and shuffles the choices
 * (stable for a given seed, so the order doesn't jump around while it's on screen).
 */
export function resolveQuestion(q, ctx, seed = 0) {
  const t = q.template ? TEMPLATES[q.template](ctx) : null;
  const base = t ? { ...q, ...t, assumption: t.assumption ?? q.assumption } : { ...q, numbers: null, example: false };
  const rng = seededRandom(hashString(q.id) ^ seed);
  const order = base.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...base, choices: order.map((i) => base.choices[i]), correct: order.indexOf(base.correct) };
}

// A missed question comes back after this many others (or at the end of a short session).
export const REQUEUE_GAP = 3;

export function startSession(questions, { mode = "practice", topic = null } = {}) {
  return {
    mode,
    topic,
    items: Object.fromEntries(questions.map((q) => [q.id, q])),
    queue: questions.map((q) => q.id),
    pos: 0,
    phase: questions.length ? "asking" : "done", // asking -> feedback -> asking ... -> done
    hinted: {},
    eliminated: {},
    requeued: {},
    log: [],
    last: null,
  };
}

export const currentQuestion = (s) => (s.phase === "done" ? null : s.items[s.queue[s.pos]]);
export const assistsFor = (s, id) => ({ hint: Boolean(s.hinted[id]), sprout: s.eliminated[id] != null });

/** Toolshed: reveals the hint (and the numbers behind the question). */
export function takeHint(s) {
  const q = currentQuestion(s);
  if (!q || s.phase !== "asking") return s;
  return { ...s, hinted: { ...s.hinted, [q.id]: true } };
}

/** Ask Sprout: rules out one wrong answer. Which one is fixed per question, so asking twice changes nothing. */
export function askSprout(s) {
  const q = currentQuestion(s);
  if (!q || s.phase !== "asking" || s.eliminated[q.id] != null) return s;
  const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.correct);
  const pick = wrong[hashString(q.id) % wrong.length];
  return { ...s, eliminated: { ...s.eliminated, [q.id]: pick } };
}

/** Records an answer. A wrong answer brings the question back later in this session, once. */
export function answer(s, choice) {
  const q = currentQuestion(s);
  if (!q || s.phase !== "asking" || choice === s.eliminated[q.id]) return s;
  const correct = choice === q.correct;
  const retry = Boolean(s.requeued[q.id]);
  let { queue, requeued } = s;
  if (!correct && !retry) {
    const at = Math.min(queue.length, s.pos + 1 + REQUEUE_GAP);
    queue = [...queue.slice(0, at), q.id, ...queue.slice(at)];
    requeued = { ...requeued, [q.id]: true };
  }
  const entry = { id: q.id, topic: q.topic, difficulty: q.difficulty, term: q.term, choice, correct, retry, assists: assistsFor(s, q.id) };
  return { ...s, queue, requeued, phase: "feedback", log: [...s.log, entry], last: { ...entry, comingBack: !correct && !retry } };
}

export function next(s) {
  if (s.phase !== "feedback") return s;
  const pos = s.pos + 1;
  return { ...s, pos, last: null, phase: pos >= s.queue.length ? "done" : "asking" };
}

/** Results by question, counting first tries (a retry that goes right is noted, not double-counted). */
export function summary(s) {
  const firstTry = s.log.filter((e) => !e.retry);
  return {
    total: firstTry.length,
    correct: firstTry.filter((e) => e.correct).length,
    fixedOnRetry: s.log.filter((e) => e.retry && e.correct).length,
    byQuestion: firstTry.map((e) => ({ ...e, question: s.items[e.id], retryCorrect: s.log.some((r) => r.retry && r.id === e.id && r.correct) })),
  };
}
