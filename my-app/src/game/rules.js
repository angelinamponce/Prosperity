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
};

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
  { id: "word-collector", name: "Word Collector", icon: "tree", how: "Learn every money word on the dashboard.", earned: (p, ctx) => ctx.termCount > 0 && Object.keys(p.terms).length >= ctx.termCount },
];

export const SCHEMA_VERSION = 1;

export function emptyProgress() {
  return {
    v: SCHEMA_VERSION,
    xp: 0,
    terms: {},
    badges: {},
    flags: { surveyDone: false, tourDone: false },
    streak: { count: 0, freezes: START_FREEZES, best: 0, total: 0, lastWeek: null },
    // Classic is the default view; Garden mode arrives in a later phase.
    settings: { view: "classic", sound: false, instantText: false },
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
    settings: { ...base.settings, ...obj(raw.settings, {}) },
  };
}

/**
 * Applies one game action and returns the new progress plus the events to celebrate.
 * Actions: { type: "learnTerm", key, title } | { type: "checkIn", week } | { type: "surveyDone" } | { type: "tourDone" }
 * Repeating an action never awards XP twice.
 */
export function reduce(progress, action, ctx = { termCount: 0 }) {
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
