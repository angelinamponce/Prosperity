import { ENCOUNTER, declined, grassStep, newEncounterState } from "../encounters";

const walk = (state, steps, rng) => {
  let s = state;
  const hits = [];
  for (let i = 1; i <= steps; i += 1) {
    const r = grassStep(s, rng);
    s = r.state;
    if (r.rustle) hits.push(i);
  }
  return { hits, state: s };
};

test("never rustles in the first quiet steps, even with the luckiest roll", () => {
  expect(walk(newEncounterState(), ENCOUNTER.quietSteps, () => 0).hits).toEqual([]);
  expect(walk(newEncounterState(), ENCOUNTER.quietSteps + 1, () => 0).hits).toEqual([ENCOUNTER.quietSteps + 1]);
});

test("each rustle starts a new quiet stretch, and Not now makes it longer", () => {
  expect(walk(newEncounterState(), 20, () => 0).hits).toEqual([7, 14]);
  expect(walk(declined(), 20, () => 0).hits).toEqual([ENCOUNTER.quietAfterNo + 1]);
});

test("about one rustle per 13 grass steps on average, and never with an unlucky roll", () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const { hits } = walk(newEncounterState(), 13000, rng);
  expect(hits.length).toBeGreaterThan(800);
  expect(hits.length).toBeLessThan(1200);
  expect(walk(newEncounterState(), 100, () => 0.99).hits).toEqual([]);
});
