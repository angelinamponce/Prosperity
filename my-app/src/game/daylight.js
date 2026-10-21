// Day and night in Garden mode: purely cosmetic lighting for the town and garden maps, from the
// player's local time. Only the pixel art is tinted; words, numbers and buttons never are.

export const PHASES = {
  morning: { label: "Morning light" },
  day: { label: "Daylight" },
  dusk: { label: "Evening light" },
  night: { label: "Night, with the lamps lit" },
};

/** The lighting phase for a local time: morning 6 to 9, day 9 to 5, dusk 5 to 8, night 8 to 6. */
export function lightPhase(date = new Date()) {
  const h = date.getHours();
  if (h >= 6 && h < 9) return "morning";
  if (h >= 9 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}
