import { FOE_STATES, foeArt } from "../foeArt";
import { FOES } from "../foes";

test("every Misconception has a clean 24 x 24 sprite in every state, using only its palette", () => {
  for (const foe of FOES) {
    for (const state of FOE_STATES) {
      const { rows, palette } = foeArt(foe.id, state);
      expect(rows).toHaveLength(24);
      for (const row of rows) {
        expect(row).toHaveLength(24);
        for (const ch of row) expect(ch === "." || ch in palette).toBe(true);
      }
    }
  }
});

test("each state looks different, and each Misconception looks different", () => {
  for (const foe of FOES) {
    const [idle, hit, happy] = FOE_STATES.map((s) => foeArt(foe.id, s).rows.join(""));
    expect(new Set([idle, hit, happy]).size).toBe(3);
  }
  const idles = FOES.map((f) => foeArt(f.id).rows.join(""));
  expect(new Set(idles).size).toBe(FOES.length);
});
