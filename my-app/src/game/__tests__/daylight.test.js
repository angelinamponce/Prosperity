import { PHASES, lightPhase } from "../daylight";

test("morning, day, dusk and night by local hour, every hour covered", () => {
  const at = (h, m = 0) => lightPhase(new Date(2026, 9, 21, h, m));
  expect([at(5, 59), at(6), at(8, 59), at(9), at(16, 59), at(17), at(19, 59), at(20), at(0)]).toEqual([
    "night", "morning", "morning", "day", "day", "dusk", "dusk", "night", "night",
  ]);
  for (let h = 0; h < 24; h += 1) expect(PHASES[at(h)].label).toBeTruthy();
});
