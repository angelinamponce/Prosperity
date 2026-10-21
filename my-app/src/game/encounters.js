// Tall-grass encounters in town. Walking through tall grass can make it rustle; the game always asks
// first ("Battle? / Not now") and never starts a battle on its own. The rules are kept plain and
// pure so they can be tested: a chance per grass step, a quiet stretch after each rustle, and a longer
// one after "Not now" so saying no is respected.

export const ENCOUNTER = { chance: 1 / 7, quietSteps: 6, quietAfterNo: 16 };

export const newEncounterState = () => ({ since: 0 });

/** One step onto tall grass: returns { rustle, state }. `rng` is injectable for tests. */
export function grassStep(state, rng = Math.random) {
  const since = state.since + 1;
  if (since > ENCOUNTER.quietSteps && rng() < ENCOUNTER.chance) return { rustle: true, state: { since: 0 } };
  return { rustle: false, state: { since } };
}

/** "Not now": a longer quiet stretch before the grass rustles again. */
export const declined = () => ({ since: ENCOUNTER.quietSteps - ENCOUNTER.quietAfterNo });
