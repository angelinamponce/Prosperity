// Game rules: XP, levels, Sprout's growth stages, badges and the weekly streak.
// Pure functions only, shared by the Classic dashboard and (later) Garden mode.
//
// Guardrail: XP comes from learning, finishing steps and checking in. Nothing here looks at
// how much money someone has or spends, so the game can never reward spending or pressure saving.

import { STAGES } from "../design/stages";

export const XP = {
  surveyDone: 50,
  tourDone: 20,
  termLearned: 10,
  checkIn: 15,
  badge: 25,
  // A mission is a habit the player says they did (honor system). Each one holds at most this much XP.
  mission: 20,
};

// ---------- Quizzes ----------

export const QUIZ_TOPICS = ["budgeting", "debt", "saving", "investing"];
// Greenhouse keeper challenges: 6 questions; 4 right on the first try earns that greenhouse's badge.
// Missing it costs nothing, and you can try again right away.
export const KEEPER = { questions: 6, pass: 4 };
const TOPIC_NAMES = { budgeting: "Budgeting", debt: "Debt", saving: "Saving", investing: "Investing" };
// A correct answer is worth this much by difficulty (1 to 3).
export const QUIZ_XP = { 1: 8, 2: 12, 3: 16 };
// Help never costs XP; it only lowers what this answer earns, and the UI says so up front.
export const ASSIST_SHARE = { none: 1, one: 0.75, both: 0.5 };

const DAY = 86400000;
// Spaced repetition: after a correct answer a question moves up a box and rests this many days.
// A wrong answer sends it back to box 0, due again right away.
export const BOX_REST_DAYS = [0, 1, 3, 7, 14, 30];
export const MAX_BOX = BOX_REST_DAYS.length - 1;

/** A question is "due" when it's new or its rest is over. Only due questions pay XP, so XP can't be farmed. */
export function isDue(qState, now) {
  return !qState || now >= qState.due;
}

export function quizXp(difficulty, assists = {}) {
  const used = (assists.hint ? 1 : 0) + (assists.sprout ? 1 : 0);
  const share = used === 0 ? ASSIST_SHARE.none : used === 1 ? ASSIST_SHARE.one : ASSIST_SHARE.both;
  return Math.round((QUIZ_XP[difficulty] ?? QUIZ_XP[1]) * share);
}

/** What a correct answer would earn right now, and why, for the XP tag next to each question. */
export function answerXpPreview(progress, question, assists, now) {
  const due = isDue(progress.quiz.q[question.id], now);
  return { xp: due ? quizXp(question.difficulty, assists) : 0, due, full: quizXp(question.difficulty) };
}

function recordAnswer(quiz, { id, topic, correct }, now) {
  const prev = quiz.q[id];
  const due = isDue(prev, now);
  let box = prev?.box ?? 0;
  let dueAt = prev?.due ?? now;
  if (!correct) {
    box = 0;
    dueAt = now;
  } else if (due) {
    box = Math.min(MAX_BOX, box + 1);
    dueAt = now + BOX_REST_DAYS[box] * DAY;
  }
  const t = quiz.topics[topic] ?? { seen: 0, correct: 0 };
  return {
    due,
    quiz: {
      ...quiz,
      q: {
        ...quiz.q,
        [id]: { seen: (prev?.seen ?? 0) + 1, correct: (prev?.correct ?? 0) + (correct ? 1 : 0), box, due: dueAt, last: now },
      },
      topics: { ...quiz.topics, [topic]: { seen: t.seen + 1, correct: t.correct + (correct ? 1 : 0) } },
    },
  };
}

// Total XP needed to reach each level. Sprout grows a stage every two levels.
export const LEVEL_XP = [0, 40, 100, 180, 280, 400, 550, 720, 920, 1150];
export const MAX_LEVEL = LEVEL_XP.length;

export function levelFor(xp) {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i += 1) if (xp >= LEVEL_XP[i]) level = i + 1;
  return level;
}

export function stageIndexFor(level) {
  return Math.min(STAGES.length - 1, Math.floor((level - 1) / 2));
}

/** Everything the UI shows about XP: level, stage and progress toward the next level. */
export function levelInfo(xp) {
  const level = levelFor(xp);
  const floor = LEVEL_XP[level - 1];
  const next = LEVEL_XP[level] ?? null;
  const stageIndex = stageIndexFor(level);
  const nextStageLevel = stageIndex < STAGES.length - 1 ? (stageIndex + 1) * 2 + 1 : null;
  return {
    xp,
    level,
    stageIndex,
    stage: STAGES[stageIndex],
    nextStage: STAGES[stageIndex + 1] ?? null,
    nextStageXp: nextStageLevel ? LEVEL_XP[nextStageLevel - 1] : null,
    intoLevel: xp - floor,
    levelSize: next == null ? 0 : next - floor,
    toNext: next == null ? 0 : next - xp,
    progress: next == null ? 1 : (xp - floor) / (next - floor),
    maxed: next == null,
  };
}

// ---------- Weekly streak ----------

// Weeks start on Monday. Day 0 (1 Jan 1970) was a Thursday, hence the +3.
export function weekNumber(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return Math.floor((day + 3) / 7);
}

export const START_FREEZES = 2;
export const MAX_FREEZES = 3;
export const CHECKINS_PER_FREEZE = 4;

/**
 * Records this week's check-in. Missed weeks are covered by freezes automatically when there are
 * enough; otherwise a fresh streak starts with a welcome, never a scolding.
 * Returns { streak, events } where events describe what happened, for friendly messages.
 */
export function applyCheckIn(streak, week) {
  if (streak.lastWeek === week) return { streak, events: [] };
  const events = [];
  let { count, freezes, best, total } = streak;
  const gap = streak.lastWeek == null ? null : week - streak.lastWeek - 1;

  if (gap == null) {
    count = 1;
    events.push({ type: "streakStart" });
  } else if (gap <= 0) {
    count += 1;
  } else if (gap <= freezes) {
    freezes -= gap;
    count += 1;
    events.push({ type: "freezeUsed", used: gap });
  } else {
    count = 1;
    events.push({ type: "welcomeBack" });
  }

  total += 1;
  if (total % CHECKINS_PER_FREEZE === 0 && freezes < MAX_FREEZES) {
    freezes += 1;
    events.push({ type: "freezeEarned" });
  }
  best = Math.max(best, count);
  return { streak: { count, freezes, best, total, lastWeek: week }, events };
}

/** The streak as it stands this week; a quiet gap that freezes can still cover keeps it alive. */
export function currentStreak(streak, week) {
  if (streak.lastWeek == null) return 0;
  const gap = week - streak.lastWeek - 1;
  return gap <= streak.freezes ? streak.count : 0;
}

// ---------- Badges ----------

// `earned(progress)` only reads game progress, never money amounts.
export const BADGES = [
  { id: "first-seed", name: "First Seed", icon: "seed", how: "Finish your money survey.", earned: (p) => p.flags.surveyDone },
  { id: "first-checkin", name: "Hello, Garden", icon: "sprout", how: "Check in for the first time.", earned: (p) => p.streak.total >= 1 },
  { id: "tour-guide", name: "Look Around", icon: "sprout", how: "Finish the dashboard tour.", earned: (p) => p.flags.tourDone },
  { id: "curious-mind", name: "Curious Mind", icon: "sapling", how: "Learn 5 money words. Tap any ? to learn one.", earned: (p) => Object.keys(p.terms).length >= 5 },
  { id: "steady-gardener", name: "Steady Gardener", icon: "young", how: "Check in during 4 different weeks. They don't need to be in a row.", earned: (p) => p.streak.total >= 4 },
  { id: "word-collector", name: "Word Collector", icon: "tree", how: "Learn every money word on the dashboard.", earned: (p, ctx) => ctx.termKeys.length > 0 && ctx.termKeys.every((k) => p.terms[k]) },
  { id: "good-question", name: "Good Question", icon: "sprout", how: "Answer a quiz question correctly.", earned: (p) => QUIZ_TOPICS.some((t) => p.quiz.topics[t]?.correct > 0) },
  { id: "well-rounded", name: "Well Rounded", icon: "young", how: "Get a quiz question right in all four topics.", earned: (p) => QUIZ_TOPICS.every((t) => p.quiz.topics[t]?.correct > 0) },
  // One for each Greenhouse keeper's challenge.
  ...QUIZ_TOPICS.map((t) => ({
    id: `keeper-${t}`,
    name: `${TOPIC_NAMES[t]} Badge`,
    icon: `gh-${t}`,
    how: `Pass the ${TOPIC_NAMES[t]} Greenhouse keeper's challenge: ${KEEPER.pass} of ${KEEPER.questions} right on the first try.`,
    earned: (p) => Boolean(p.quiz.keepers[t]?.passedAt),
  })),
];

export const SCHEMA_VERSION = 2;

export function emptyProgress() {
  return {
    v: SCHEMA_VERSION,
    xp: 0,
    terms: {},
    badges: {},
    flags: { surveyDone: false, tourDone: false },
    streak: { count: 0, freezes: START_FREEZES, best: 0, total: 0, lastWeek: null },
    // q: per-question history and review timing; topics: answers per topic.
    // befriended[foeId] = { first, times }; keepers[topic] = { best, tries, passedAt, last }.
    quiz: { q: {}, topics: {}, befriended: {}, keepers: {} },
    // missions[id] = { done, at, xp }: xp is what this mission currently holds (0 or XP.mission).
    missions: {},
    // Debts seen in the player's own survey numbers (never the sample), and the ones since paid off.
    // Only a debt that really reaches $0 in the survey gets a victory; nothing here is ever invented.
    debts: { seen: {}, cleared: {} },
    // Classic is the default view; Garden mode arrives in a later phase.
    settings: { view: "classic", sound: false, instantText: false, speedRound: false, encounters: true },
  };
}

// Fills in anything missing from older or damaged saves so the app never crashes on bad storage.
export function normalizeProgress(raw) {
  const base = emptyProgress();
  if (!raw || typeof raw !== "object") return base;
  const obj = (v, d) => (v && typeof v === "object" && !Array.isArray(v) ? v : d);
  return {
    ...base,
    xp: Number.isFinite(raw.xp) && raw.xp > 0 ? raw.xp : 0,
    terms: obj(raw.terms, {}),
    badges: obj(raw.badges, {}),
    flags: { ...base.flags, ...obj(raw.flags, {}) },
    streak: { ...base.streak, ...obj(raw.streak, {}) },
    quiz: Object.fromEntries(Object.keys(base.quiz).map((k) => [k, obj(obj(raw.quiz, {})[k], {})])),
    missions: obj(raw.missions, {}),
    debts: { seen: obj(obj(raw.debts, {}).seen, {}), cleared: obj(obj(raw.debts, {}).cleared, {}) },
    settings: { ...base.settings, ...obj(raw.settings, {}) },
  };
}

/**
 * Applies one game action and returns the new progress plus the events to celebrate.
 * Actions: { type: "learnTerm", key, title } | { type: "checkIn", week } | { type: "surveyDone" } | { type: "tourDone" }
 *        | { type: "answerQuestion", id, topic, difficulty, correct, assists: { hint, sprout }, term?, termTitle? }
 *        | { type: "befriend", id, name } | { type: "keeperResult", topic, firstTry, total }
 *        | { type: "noteDebts", names } | { type: "debtCleared", name }
 *        | { type: "completeMission", id, title } | { type: "undoMission", id }
 * Repeating an action never awards XP twice. ctx.termKeys lists the dashboard's money words.
 */
export function reduce(progress, action, ctx = { termKeys: [] }) {
  let p = progress;
  const events = [];
  const addXp = (amount, label) => {
    p = { ...p, xp: p.xp + amount };
    events.push({ type: "xp", amount, label });
  };

  switch (action.type) {
    case "learnTerm":
      if (p.terms[action.key]) break;
      p = { ...p, terms: { ...p.terms, [action.key]: true } };
      addXp(XP.termLearned, `You learned "${action.title ?? action.key}"`);
      break;
    case "checkIn": {
      const res = applyCheckIn(p.streak, action.week);
      if (res.streak === p.streak) break;
      p = { ...p, streak: res.streak };
      events.push(...res.events.map((e) => ({ ...e, count: res.streak.count })));
      addXp(XP.checkIn, res.streak.count > 1 ? `Weekly check-in · ${res.streak.count}-week streak` : "Weekly check-in");
      break;
    }
    case "surveyDone":
      if (p.flags.surveyDone) break;
      p = { ...p, flags: { ...p.flags, surveyDone: true } };
      addXp(XP.surveyDone, "Your plan is planted");
      break;
    case "tourDone":
      if (p.flags.tourDone) break;
      p = { ...p, flags: { ...p.flags, tourDone: true } };
      addXp(XP.tourDone, "Tour finished");
      break;
    case "answerQuestion": {
      const now = action.at ?? Date.now();
      const res = recordAnswer(p.quiz, action, now);
      p = { ...p, quiz: res.quiz };
      // Wrong answers cost nothing; they just come back sooner.
      if (action.correct && res.due) addXp(quizXp(action.difficulty, action.assists), "Correct answer");
      // The first right answer about a word counts as learning it (once, like opening its "?").
      if (action.correct && action.term && !p.terms[action.term]) {
        p = { ...p, terms: { ...p.terms, [action.term]: true } };
        addXp(XP.termLearned, `You learned "${action.termTitle ?? action.term}"`);
      }
      break;
    }
    case "keeperResult": {
      // Keeps the best first-try score and when the challenge was first passed. A miss never takes anything away.
      const prev = p.quiz.keepers[action.topic] ?? { best: 0, tries: 0, passedAt: null };
      const at = action.at ?? Date.now();
      const passed = action.firstTry >= KEEPER.pass;
      const next = { best: Math.max(prev.best, action.firstTry), tries: prev.tries + 1, passedAt: prev.passedAt ?? (passed ? at : null), last: action.firstTry };
      p = { ...p, quiz: { ...p.quiz, keepers: { ...p.quiz.keepers, [action.topic]: next } } };
      events.push({ type: "keeperResult", topic: action.topic, passed, firstTime: passed && !prev.passedAt });
      break;
    }
    case "noteDebts": {
      // Remembers each survey debt the first time it's seen. No XP: money never earns XP.
      const fresh = action.names.filter((n) => !p.debts.seen[n]);
      if (!fresh.length) break;
      const at = action.at ?? Date.now();
      p = { ...p, debts: { ...p.debts, seen: { ...p.debts.seen, ...Object.fromEntries(fresh.map((n) => [n, at])) } } };
      break;
    }
    case "debtCleared": {
      // A debt the survey now shows at $0. Celebrated once; no XP, because XP never rewards dollar amounts.
      if (!p.debts.seen[action.name] || p.debts.cleared[action.name]) break;
      p = { ...p, debts: { ...p.debts, cleared: { ...p.debts.cleared, [action.name]: action.at ?? Date.now() } } };
      events.push({ type: "debtCleared", name: action.name });
      break;
    }
    case "befriend": {
      // Remembered for the Garden Dex. No extra XP: the answers that won it already earned that.
      const prev = p.quiz.befriended[action.id];
      const at = action.at ?? Date.now();
      p = { ...p, quiz: { ...p.quiz, befriended: { ...p.quiz.befriended, [action.id]: { first: prev?.first ?? at, times: (prev?.times ?? 0) + 1 } } } };
      if (!prev) events.push({ type: "befriended", id: action.id, name: action.name });
      break;
    }
    case "completeMission": {
      const prev = p.missions[action.id];
      if (prev?.done) break;
      // A mission never holds more than XP.mission, so complete, undo, redo can't add up.
      const gain = XP.mission - (prev?.xp ?? 0);
      p = { ...p, missions: { ...p.missions, [action.id]: { done: true, at: action.at ?? Date.now(), xp: XP.mission } } };
      if (gain > 0) addXp(gain, `Mission done: ${action.title ?? "nice habit"}`);
      break;
    }
    case "undoMission": {
      const prev = p.missions[action.id];
      if (!prev?.done) break;
      // Undo takes back exactly what this mission gave.
      p = { ...p, xp: Math.max(0, p.xp - (prev.xp ?? 0)), missions: { ...p.missions, [action.id]: { done: false, at: null, xp: 0 } } };
      events.push({ type: "missionUndone", amount: prev.xp ?? 0 });
      break;
    }
    default:
      return { progress, events: [] };
  }

  // Badges can unlock after any action; each one is awarded once.
  for (const b of BADGES) {
    if (!p.badges[b.id] && b.earned(p, ctx)) {
      p = { ...p, badges: { ...p.badges, [b.id]: { at: action.at ?? Date.now() } } };
      events.push({ type: "badge", badge: b });
      addXp(XP.badge, `Badge earned: ${b.name}`);
    }
  }

  const before = levelInfo(progress.xp);
  const after = levelInfo(p.xp);
  if (after.level > before.level) events.push({ type: "levelUp", level: after.level });
  if (after.stageIndex > before.stageIndex) events.push({ type: "stageUp", from: before.stage, to: after.stage });
  return { progress: p, events };
}
