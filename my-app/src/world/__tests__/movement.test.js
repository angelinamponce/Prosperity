import { buildingEntered, describeSpot, directionTo, facingPlace, findPath, pathToward, step } from "../movement";
import { BUILDINGS, SPAWN, isWalkable } from "../town";
import { SPROUT_FRAMES, SPROUT_PALETTE } from "../sprites";

const home = BUILDINGS.find((b) => b.id === "home");
const library = BUILDINGS.find((b) => b.id === "library");

describe("step and collisions", () => {
  test("walks onto open ground", () => {
    expect(step(SPAWN, "down")).toEqual({ pos: { x: 3, y: 7 }, moved: true, enter: null });
  });

  test("can't walk through trees, water, fences or walls", () => {
    expect(step({ x: 1, y: 1 }, "up").moved).toBe(false); // tree
    expect(step({ x: 3, y: 8 }, "left").moved).toBe(false); // pond
    expect(step({ x: 8, y: 6 }, "up").moved).toBe(true); // the plot's gate is open...
    expect(step({ x: 8, y: 5 }, "up").moved).toBe(false); // ...but the soil isn't walkable
    expect(step({ x: 6, y: 3 }, "right").moved).toBe(false); // fence
    expect(step({ x: 2, y: 5 }, "up").moved).toBe(false); // Home's wall, away from the door
  });

  test("walking up from a door goes inside; bumping a wall doesn't", () => {
    expect(step(home.door, "up")).toMatchObject({ moved: false, enter: home });
    expect(buildingEntered({ x: 2, y: 5 }, "up")).toBeNull();
    expect(buildingEntered(home.door, "left")).toBeNull();
  });

  test("the interact button finds what Sprout is facing", () => {
    expect(facingPlace(home.door, "up").id).toBe("home");
    expect(facingPlace({ x: 8, y: 6 }, "up").id).toBe("plot"); // the gate is part of the plot
    expect(facingPlace({ x: 12, y: 9 }, "right")).toBeNull(); // open grass
  });
});

describe("path finding for tap-to-move", () => {
  test("finds the shortest route, one tile at a time, around obstacles", () => {
    const path = findPath(SPAWN, library.door);
    expect(path[path.length - 1]).toEqual(library.door);
    expect(path.every(({ x, y }) => isWalkable(x, y))).toBe(true);
    let prev = SPAWN;
    for (const p of path) {
      expect(Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y)).toBe(1);
      prev = p;
    }
    // Spawn (3,6) to the Library door (16,5): 13 across and 1 up, the shortest possible.
    expect(path.length).toBe(14);
  });

  test("tapping a building walks to its door", () => {
    const path = pathToward(SPAWN, { x: 17, y: 3 });
    expect(path[path.length - 1]).toEqual(library.door);
  });

  test("tapping a tree or the pond walks to the closest tile beside it", () => {
    const path = pathToward(SPAWN, { x: 2, y: 7 }); // pond
    const end = path[path.length - 1];
    expect(isWalkable(end.x, end.y)).toBe(true);
    expect(Math.abs(end.x - 2) + Math.abs(end.y - 7)).toBe(1);
  });

  test("nowhere to go returns null, and standing still is an empty path", () => {
    expect(findPath(SPAWN, { x: 0, y: 0 })).toBeNull();
    expect(findPath(SPAWN, SPAWN)).toEqual([]);
  });

  test("directions between neighbors", () => {
    expect(directionTo({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe("right");
    expect(directionTo({ x: 1, y: 1 }, { x: 1, y: 0 })).toBe("up");
  });
});

test("Sprout's whereabouts in plain words", () => {
  expect(describeSpot(home.door)).toBe("at the door of Home");
  expect(describeSpot({ x: 16, y: 6 })).toBe("near the Library");
  expect(describeSpot({ x: 5, y: 13 })).toMatch(/near the Budgeting Greenhouse|in the tall grass/);
  expect(describeSpot({ x: 3, y: 8 })).toBe("by the pond");
  expect(describeSpot({ x: 12, y: 1 })).toBe("on the path");
  expect(describeSpot({ x: 9, y: 6 })).toBe("by your garden plot");
});

test("every walking frame is a clean 16 x 16 grid", () => {
  for (const dir of ["down", "up", "left"]) {
    expect(SPROUT_FRAMES[dir]).toHaveLength(3);
    for (const frame of SPROUT_FRAMES[dir]) {
      expect(frame).toHaveLength(16);
      for (const row of frame) {
        expect(row).toHaveLength(16);
        for (const ch of row) expect(ch === "." || ch in SPROUT_PALETTE).toBe(true);
      }
    }
  }
});
