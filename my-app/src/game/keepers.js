// The Greenhouse keepers: one gardener per quiz topic. Each teaches a few plain lines, then offers a
// challenge of KEEPER.questions questions against the topic's Misconceptions. KEEPER.pass right on the
// first try earns that greenhouse's badge (through the shared badge system). All names are original.

import { KEEPER } from "./rules";

export const KEEPERS = {
  budgeting: {
    name: "Keeper Fern",
    greenhouse: "gh-budgeting",
    teach: [
      "Welcome to the Budgeting Greenhouse! I'm Keeper Fern.",
      "A budget is just a plan: what comes in, what goes out, and where the rest goes.",
      "Needs come first, then wants. Paying yourself first makes saving happen on its own.",
    ],
  },
  debt: {
    name: "Keeper Bram",
    greenhouse: "gh-debt",
    teach: [
      "Welcome to the Debt Greenhouse. I'm Keeper Bram.",
      "Every debt has an APR: what it costs you in interest over a year.",
      "A minimum payment keeps you in good standing, but much of it can go to interest. Extra payments are what shrink the balance.",
    ],
  },
  saving: {
    name: "Keeper Maple",
    greenhouse: "gh-saving",
    teach: [
      "Hello! I'm Keeper Maple, and this is the Saving Greenhouse.",
      "An emergency fund is money for surprises. Many people aim for 3 to 6 months of essentials.",
      "Saving automatically on payday means you never have to remember to do it.",
    ],
  },
  investing: {
    name: "Keeper Rowan",
    greenhouse: "gh-investing",
    teach: [
      "Welcome to the Investing Greenhouse. I'm Keeper Rowan.",
      "Investing means owning small pieces of many things, so they can grow over time. Prices go up and down, and nothing is guaranteed.",
      "Spreading your money out and keeping costs low both help. So does staying calm when prices dip.",
    ],
  },
};

/** Where this topic's keeper challenge stands: { best, tries, passed }. */
export function keeperStatus(progress, topic) {
  const k = progress.quiz.keepers[topic];
  return { best: k?.best ?? 0, tries: k?.tries ?? 0, passed: Boolean(k?.passedAt) };
}

/** The result line for a finished challenge, the same in the battle and the Classic quiz. */
export function keeperVerdict(topic, firstTry, total) {
  const keeper = KEEPERS[topic];
  if (firstTry >= KEEPER.pass) return `${keeper.name}: You passed! ${firstTry} of ${total} right on the first try.`;
  return `${keeper.name}: ${firstTry} of ${total} on the first try. ${KEEPER.pass} earns the badge. The ones you missed will come back for review, and you can try again any time.`;
}
