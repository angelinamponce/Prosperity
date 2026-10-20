import { useState } from "react";
import { CheckOutlined } from "@ant-design/icons";
import { Term } from "../design";
import { useGame } from "../game/store";
import { XP } from "../game/rules";

// Plain-language explanations for the money words used on the dashboard.
export const GLOSSARY = {
  netWorth: { title: "Net worth", explain: "Add up everything you own (cash, investments, your car) and subtract everything you owe. It's a snapshot of where you stand today." },
  healthScore: { title: "Financial health score", explain: "A score out of 100 based on six everyday habits, like how much you save and how much debt you carry. It's a starting point, not a judgment." },
  savingsRate: { title: "Savings rate", explain: "The share of your income you keep each month instead of spending. Around 20% is a great goal, but every bit counts." },
  emergencyFund: { title: "Emergency fund", explain: "Money set aside for surprises, like a car repair or a gap between jobs. Many people aim for 3 to 6 months of essential expenses." },
  surplus: { title: "Surplus", explain: "What's left after your bills and minimum debt payments. This is the money you get to direct toward your goals." },
  flexible: { title: "Flexible spending", explain: "Costs you have some control over, like dining out, shopping and subscriptions, as opposed to fixed bills like rent." },
  payoffOrder: { title: "Payoff strategies", explain: "“Highest interest first” (the avalanche) saves the most money overall. “Smallest balance first” (the snowball) gets you quick wins that feel great. Both work!" },
  apr: { title: "APR", explain: "Annual percentage rate: what a debt costs you in interest over a year. A higher APR means the debt grows faster." },
  match: { title: "401(k) match", explain: "Many employers add money to your retirement account when you contribute. If they match up to 5%, putting in 5% gets you that extra money for free." },
  investOptions: { title: "Investment options", explain: "Savings accounts are safest but grow slowly. Bonds are steady loans to governments or companies. Stocks are small pieces of companies and grow most over time, with more ups and downs." },
  simulation: { title: "Possible futures", explain: "We replay 500 versions of the market, some good years and some bad, to show a realistic range instead of one guess. The middle line is the most typical result." },
  fi: { title: "Financial independence", explain: "Having enough invested that your money could cover your living costs. A common rule of thumb is 25 times what you spend in a year." },

  // Words taught by the quizzes.
  budget: { title: "Budget", explain: "A plan for your money: what comes in, what goes out, and where the rest goes. It's not about cutting everything, just choosing on purpose." },
  needsWants: { title: "Needs and wants", explain: "Needs are what you must pay to live and work, like rent, groceries and getting to your job. Wants make life nicer but can wait or shrink, like takeout or new gadgets." },
  rule503020: { title: "50/30/20 rule", explain: "A simple starting budget: about 50% of take-home pay for needs, 30% for wants, and 20% for savings and extra debt payments. Adjust it to fit your life." },
  payYourselfFirst: { title: "Pay yourself first", explain: "Moving money into savings as soon as you're paid, before spending on anything else. An automatic transfer makes it easy." },
  minimumPayment: { title: "Minimum payment", explain: "The smallest amount a lender lets you pay each month. Paying it keeps you in good standing, but much of it can go to interest, so the debt shrinks slowly." },
  compoundInterest: { title: "Compound interest", explain: "Interest that gets added to your balance and then earns (or charges) interest itself. It helps savings grow faster, and makes unpaid debt grow faster too." },
  creditScore: { title: "Credit score", explain: "A number, usually from 300 to 850, that shows lenders how reliably you pay back money. Paying on time, every time, matters most." },
  creditUtilization: { title: "Credit utilization", explain: "How much of your credit card limits you're using. Staying under about 30%, and lower is better, helps your credit score." },
  inflation: { title: "Inflation", explain: "The slow rise in prices over time. If prices go up 3% in a year, $100 buys a little less next year than it does today." },
  indexFund: { title: "Index fund", explain: "A fund that buys a small piece of every company on a list, like the 500 biggest US companies. It's spread out and usually low-cost." },
  diversification: { title: "Diversification", explain: "Spreading your money across many investments so no single one can sink you. It lowers risk, though it can't remove it." },
  hysa: { title: "High-yield savings account", explain: "A savings account that pays more interest than a typical one. Your money stays easy to reach, and at an insured bank or credit union it's protected up to the legal limit." },
};

// The words that appear on the dashboard pages. The Word Collector badge is for learning all of these.
export const DASHBOARD_TERMS = ["netWorth", "healthScore", "savingsRate", "emergencyFund", "surplus", "flexible", "payoffOrder", "apr", "match", "investOptions", "simulation", "fi"];

// <Explain k="netWorth">Net worth</Explain> renders the label with its "what's this?" button.
// Inside the dashboard, opening a word for the first time counts it as learned and earns XP.
export function Explain({ k, children }) {
  const g = GLOSSARY[k];
  const game = useGame();
  const [justLearned, setJustLearned] = useState(false);
  const known = game?.ready && game.progress.terms[k];
  const onOpen = () => {
    if (!game?.ready || known) return;
    setJustLearned(true);
    game.learnTerm(k, g.title);
  };
  let footer = null;
  if (justLearned) footer = <span className="gm-term-note">New word learned · +{XP.termLearned} XP</span>;
  else if (known) footer = <span className="gm-term-note"><CheckOutlined aria-hidden /> You've learned this one</span>;
  return (
    <Term title={g.title} explain={g.explain} onOpen={onOpen} footer={footer}>
      {children ?? g.title}
    </Term>
  );
}
