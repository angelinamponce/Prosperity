// The Misconceptions: friendly creatures who believe a money myth. Battles don't defeat them; clear
// thinking befriends them. Each has the myth it believes and the truth that befriends it (shown in the
// Garden Dex). All names and designs are original to Prosperity.

export const FOES = [
  { id: "guesswork-gnat", name: "Guesswork Gnat", topic: "budgeting", color: "#8fb8de", intro: "buzzed out of the tall grass!", myth: "I know roughly where my money goes, so I don't need a budget.", truth: "Writing it down shows the small leaks that guesses miss.", befriend: "stops guessing and starts writing things down." },
  { id: "minimum-mite", name: "Minimum Mite", topic: "debt", color: "#e7a07a", intro: "scuttled out of the tall grass!", myth: "Paying only the minimum is fine.", truth: "Much of a minimum payment goes to interest, so the balance shrinks slowly. A little extra each month goes a long way.", befriend: "decides to pay a little extra each month." },
  { id: "interest-imp", name: "Interest Imp", topic: "debt", color: "#c79ad6", intro: "popped up with a grin!", myth: "The rate doesn't matter if the monthly payment is low.", truth: "A higher APR means more of every payment goes to interest. Compare the APR, not just the payment.", befriend: "finally reads the APR on its card." },
  { id: "someday-snail", name: "Someday Snail", topic: "saving", color: "#a8c98a", intro: "slowly slid into view!", myth: "I'll start saving someday, when I earn more.", truth: "Starting small today gives time more room to work. Even $25 a month adds up.", befriend: "sets up an automatic transfer for today, not someday." },
  { id: "hype-hornet", name: "Hype Hornet", topic: "investing", color: "#e0b25c", intro: "zoomed in, chasing a hot tip!", myth: "This hot tip can't miss.", truth: "No investment is guaranteed. Spreading money across many investments lowers the risk of one bad pick.", befriend: "trades hot tips for a steady, spread-out plan." },
  { id: "panic-puff", name: "Panic Puff", topic: "investing", color: "#9fc4c9", intro: "puffed up in a worry!", myth: "When the market drops, sell everything!", truth: "Markets rise and fall. Selling in a panic can lock in a loss; a long-term plan is built to ride out dips. Past results never guarantee future ones.", befriend: "takes a deep breath and sticks to the plan." },
];

export const foeById = (id) => FOES.find((f) => f.id === id);

/** A foe for this topic, chosen with the given random source. */
export function pickFoe(topic, rng = Math.random) {
  const options = FOES.filter((f) => f.topic === topic);
  return options[Math.floor(rng() * options.length)] ?? FOES[0];
}
