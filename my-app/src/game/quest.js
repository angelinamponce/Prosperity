// Today's quest: the one next step the dashboard leads with. Pure, so the choice is easy to test.
// Every quest says what it's worth and roughly how long it takes; none of them reward spending.

import { QUIZ_XP, XP } from "./rules";

const startOfDay = (now) => new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
const quizXpRange = `${QUIZ_XP[1]}–${QUIZ_XP[3]} XP each`;

/**
 * fromSurvey: the dashboard shows the player's own survey numbers.
 * recs: the plan's ranked next steps (buildRecommendations), each with a `habit` sentence.
 * words: [{ key, title, explain }] money words in the order to suggest them.
 * dueCount: quiz questions that are new or due.
 * Order: finish the survey, the first unfinished mission, a quick quiz (once a day), a new money word,
 * then a quick battle, so there's always something small to do.
 */
export function pickQuest({ fromSurvey, recs = [], progress, words = [], dueCount = 0, now = Date.now() }) {
  if (!fromSurvey) {
    return {
      id: "survey",
      kind: "survey",
      title: "Plant your first seed",
      why: "Finish your money survey so this dashboard uses your own numbers instead of the sample.",
      xp: `+${XP.surveyDone} XP`,
      time: "About 5 min",
      action: { label: "Finish my survey", to: "/signup" },
    };
  }

  const mission = recs.find((r) => r.habit && !progress.missions[r.id]?.done);
  if (mission) {
    return {
      id: `mission-${mission.id}`,
      kind: "mission",
      title: mission.title,
      why: mission.because,
      impact: mission.impact,
      xp: `+${XP.mission} XP`,
      time: "About 10 min",
      action: { label: "Show me how", page: mission.page },
      mission: { id: mission.id, habit: mission.habit, title: mission.title },
    };
  }

  const today = startOfDay(now);
  const quizzedToday = Object.values(progress.quiz.q).some((q) => q.last >= today);
  if (dueCount > 0 && !quizzedToday) {
    return {
      id: "quiz",
      kind: "quiz",
      title: "Answer 5 quick questions",
      why: "Questions you've missed come back so they stick. There's no timer.",
      xp: quizXpRange,
      time: "About 3 min",
      action: { label: "Start a quick quiz", page: "quiz" },
    };
  }

  const word = words.find((w) => !progress.terms[w.key]);
  if (word) {
    return {
      id: `word-${word.key}`,
      kind: "word",
      title: `Learn a money word: ${word.title}`,
      why: word.explain,
      xp: `+${XP.termLearned} XP`,
      time: "Under 1 min",
      action: { label: "Got it", learn: word.key },
      word,
    };
  }

  return {
    id: "battle",
    kind: "battle",
    title: "A question popped up nearby",
    why: "Help Sprout befriend a Misconception in a quick, friendly quiz battle.",
    xp: quizXpRange,
    time: "About 2 min",
    action: { label: "Start a quick battle", page: "battle" },
  };
}
