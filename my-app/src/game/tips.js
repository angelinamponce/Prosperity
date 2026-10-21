// Sprout's tips: one a day in the Garden Almanac. Plain English, true for most people, and never a
// promise of returns or a push to spend or take risks. Each is a habit or an idea, not a dollar target.

export const TIPS = [
  "Pay every bill's minimum on time first. Missed payments cost the most, in fees and in your credit score.",
  "A small automatic transfer on payday saves money before you have a chance to spend it.",
  "Start an emergency fund small. Even $500 can turn a surprise bill into a bump instead of a crisis.",
  "If your employer matches retirement savings, putting in enough to get the full match is like getting extra pay.",
  "Check the APR on your cards once. Knowing the highest one tells you where extra payments save the most.",
  "Before a big purchase, wait a day or two. If you still want it, it'll still be there.",
  "Look at last month's spending once a week. Noticing is often enough to change a habit.",
  "Subscriptions add up quietly. Once in a while, list them and cancel the ones you've forgotten about.",
  "Paying a little more than the minimum on a card shrinks the balance much faster than the minimum alone.",
  "A budget isn't about cutting everything. It's about choosing where your money goes on purpose.",
  "Needs come first: housing, food, getting to work. Wants can wait or shrink when money is tight.",
  "Keep emergency savings somewhere easy to reach but separate from everyday spending.",
  "High-yield savings accounts at insured banks pay more interest than many regular accounts, and your money stays easy to reach.",
  "Investing is for money you won't need for years. Money for the next few years is safer in savings.",
  "Spreading investments across many companies lowers the risk that one bad one hurts you a lot.",
  "Markets go up and down. A plan you can stick with through the dips matters more than picking the perfect moment.",
  "No investment is guaranteed. Be wary of anyone promising sure returns or telling you to hurry.",
  "Low fees matter. Over many years, a small yearly fee can take a big bite out of what you've saved.",
  "Your credit score mostly comes from paying on time and not using too much of your card limits.",
  "Using less than about 30% of your card limits helps your credit score. Lower is even better.",
  "Inflation means prices slowly rise. Money that sits still slowly buys a little less each year.",
  "Write down one money goal and a date. A clear goal makes everyday choices easier.",
  "When you get a raise, try saving part of it before you get used to spending it.",
  "Comparing prices for big, regular bills like insurance and phone plans once a year can save real money.",
  "It's okay to start small. A steady habit beats a big plan you can't keep up.",
  "If money is tight this month, that's okay. Minimums first, then pick one small step for next month.",
  "Talk about money goals with people you share costs with. Surprises are harder than plans.",
  "Keep important money documents in one safe place, so you can find them when you need them.",
  "Unexpected money, like a tax refund, can go a long way toward an emergency fund or a high-interest debt.",
  "Celebrate progress. Paying off a card or reaching a savings goal is worth noticing.",
  "Free checking and savings accounts exist. If you're paying monthly account fees, it's worth a look.",
  "Before signing up for a loan, look at the total cost over its life, not just the monthly payment.",
];

const DAY_MS = 86400000;

/** Today's tip: the same for everyone on a given day, a different one the next day. */
export function tipOfTheDay(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  return { text: TIPS[((day % TIPS.length) + TIPS.length) % TIPS.length], n: (((day % TIPS.length) + TIPS.length) % TIPS.length) + 1 };
}
