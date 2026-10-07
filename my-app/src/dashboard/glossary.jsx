import { Term } from "../design";

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
};

// <Explain k="netWorth">Net worth</Explain> renders the label with its "what's this?" button.
export function Explain({ k, children }) {
  const g = GLOSSARY[k];
  return (
    <Term title={g.title} explain={g.explain}>
      {children ?? g.title}
    </Term>
  );
}
