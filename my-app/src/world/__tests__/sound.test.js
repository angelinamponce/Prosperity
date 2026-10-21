import { SFX, setSoundEnabled, sfx } from "../sound";

test("every effect is short, and nothing plays while sound is off (the default)", () => {
  for (const [name, notes] of Object.entries(SFX)) {
    const total = notes.reduce((a, n) => a + n[1], 0);
    expect(total).toBeLessThan(1); // effects, not music
    expect(name).toBeTruthy();
  }
  expect(sfx("select")).toBe(false);
});

test("with sound on but no audio support (like here), it fails quietly", () => {
  setSoundEnabled(true);
  expect(() => sfx("correct")).not.toThrow();
  expect(sfx("nope")).toBe(false);
  setSoundEnabled(false);
});
