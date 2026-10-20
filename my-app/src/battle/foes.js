// The Misconceptions: friendly creatures who believe a money myth. Battles don't defeat them; clear
// thinking befriends them. All names and designs are original to Prosperity.

export const FOES = [
  { id: "guesswork-gnat", name: "Guesswork Gnat", topic: "budgeting", color: "#8fb8de", intro: "buzzed out of the tall grass!", befriend: "stops guessing and starts writing things down." },
  { id: "minimum-mite", name: "Minimum Mite", topic: "debt", color: "#e7a07a", intro: "scuttled out of the tall grass!", befriend: "decides to pay a little extra each month." },
  { id: "interest-imp", name: "Interest Imp", topic: "debt", color: "#c79ad6", intro: "popped up with a grin!", befriend: "finally reads the APR on its card." },
  { id: "someday-snail", name: "Someday Snail", topic: "saving", color: "#a8c98a", intro: "slowly slid into view!", befriend: "sets up an automatic transfer for today, not someday." },
  { id: "hype-hornet", name: "Hype Hornet", topic: "investing", color: "#e0b25c", intro: "zoomed in, chasing a hot tip!", befriend: "trades hot tips for a steady, spread-out plan." },
  { id: "panic-puff", name: "Panic Puff", topic: "investing", color: "#9fc4c9", intro: "puffed up in a worry!", befriend: "takes a deep breath and sticks to the plan." },
];

export const foeById = (id) => FOES.find((f) => f.id === id);

/** A foe for this topic, chosen with the given random source. */
export function pickFoe(topic, rng = Math.random) {
  const options = FOES.filter((f) => f.topic === topic);
  return options[Math.floor(rng() * options.length)] ?? FOES[0];
}
