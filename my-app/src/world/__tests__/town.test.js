import { BUILDINGS, COLS, MAP, MAP_H, MAP_W, PLOT, ROWS, SPAWN, isWalkable, placeAt, tileAt } from "../town";
import { edgesOf, groupOf, noise, pixelScale } from "../ground";
import { SPROUT_FRONT, SPROUT_PALETTE } from "../sprites";

describe("the town map", () => {
  test("is a 24 x 15 grid in the screen's 16:10 shape", () => {
    expect(COLS).toBe(24);
    expect(ROWS).toBe(15);
    expect(MAP.every((row) => row.length === COLS)).toBe(true);
    expect(MAP_W / MAP_H).toBeCloseTo(16 / 10);
    expect(MAP.join("")).toMatch(/^[T.,=~*#s]+$/);
  });

  test("buildings stand on grass, inside the map, without overlapping", () => {
    const taken = new Set();
    for (const b of BUILDINGS) {
      for (let y = b.y; y < b.y + b.h; y += 1) {
        for (let x = b.x; x < b.x + b.w; x += 1) {
          expect(tileAt(x, y)).toBe(".");
          expect(taken.has(`${x},${y}`)).toBe(false);
          taken.add(`${x},${y}`);
        }
      }
    }
  });

  test("every door opens onto a path, right below its building", () => {
    for (const b of BUILDINGS) {
      expect(tileAt(b.door.x, b.door.y)).toBe("=");
      expect(b.door.y).toBe(b.y + b.h);
      expect(b.door.x).toBeGreaterThanOrEqual(b.x);
      expect(b.door.x).toBeLessThan(b.x + b.w);
    }
  });

  test("Sprout can walk from the start to every door", () => {
    const seen = new Set([`${SPAWN.x},${SPAWN.y}`]);
    const queue = [SPAWN];
    while (queue.length) {
      const { x, y } = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (!seen.has(k) && isWalkable(x + dx, y + dy)) {
          seen.add(k);
          queue.push({ x: x + dx, y: y + dy });
        }
      }
    }
    for (const b of BUILDINGS) expect(seen.has(`${b.door.x},${b.door.y}`)).toBe(true);
  });

  test("trees, water, fences, soil and buildings block the way", () => {
    expect(isWalkable(0, 0)).toBe(false); // tree
    expect(isWalkable(1, 7)).toBe(false); // water
    expect(isWalkable(7, 3)).toBe(false); // fence
    expect(isWalkable(8, 3)).toBe(false); // soil
    expect(isWalkable(3, 3)).toBe(false); // Home
    expect(isWalkable(SPAWN.x, SPAWN.y)).toBe(true);
    expect(placeAt(3, 3).id).toBe("home");
    expect(placeAt(8, 3).id).toBe(PLOT.id);
  });
});

describe("ground", () => {
  test("edges appear only where different kinds of ground meet", () => {
    expect(groupOf("=")).toBe("path");
    expect(groupOf(",")).toBe("green");
    // The path tile in front of Home's door has grass on both sides and path above and below.
    expect(edgesOf(3, 5)).toEqual({ n: true, s: false, e: true, w: true });
    expect(edgesOf(6, 9)).toEqual({ n: false, e: false, s: false, w: false });
  });

  test("the noise pattern is the same every time", () => {
    expect(noise(10, 20)).toBe(noise(10, 20));
    expect(noise(10, 20)).not.toBe(noise(20, 10));
    expect(noise(3, 4)).toBeGreaterThanOrEqual(0);
    expect(noise(3, 4)).toBeLessThan(1);
  });
});

describe("pixelScale", () => {
  const crisp = (s, dpr) => Number.isInteger(Math.round(s * dpr * 1e6) / 1e6);

  test("an exact fit is used as is", () => {
    expect(pixelScale(768, 480, 1)).toBe(2);
  });

  test("phone (3x screen): 3 device pixels per art pixel, a border of about 3px", () => {
    const s = pixelScale(390, 244, 3);
    expect(s).toBe(1);
    expect((390 - 384 * s) / 2).toBeLessThan(4);
  });

  test("laptop (2x screen): steps up to a crisp scale, cropping only part of the tree border", () => {
    const s = pixelScale(556, 347, 2);
    expect(s).toBe(1.5);
    expect(crisp(s, 2)).toBe(true);
    expect((384 * s - 556) / 2 / s).toBeLessThanOrEqual(12);
  });

  test("when no crisp scale fits well, it fills the space instead of leaving a big border", () => {
    const s = pixelScale(556, 347, 1); // 1x would leave almost a third empty, 2x would crop too much
    expect(s).toBeCloseTo(347 / 240);
  });
});

test("Sprout's sprite is a clean 16 x 16 grid using only its palette", () => {
  expect(SPROUT_FRONT).toHaveLength(16);
  for (const row of SPROUT_FRONT) {
    expect(row).toHaveLength(16);
    for (const ch of row) expect(ch === "." || ch in SPROUT_PALETTE).toBe(true);
  }
});
