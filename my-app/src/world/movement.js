// How Sprout moves around town: one tile at a time, never through buildings, trees, water or fences.
// Pure functions, so collisions and path finding are easy to test.

import { BUILDINGS, COLS, PLOT, ROWS, isWalkable, placeAt, tileAt } from "./town";

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const key = (p) => `${p.x},${p.y}`;
const add = (p, dir) => ({ x: p.x + DIRS[dir][0], y: p.y + DIRS[dir][1] });

/** The direction from one tile to a neighboring tile. */
export function directionTo(from, to) {
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  if (to.y > from.y) return "down";
  return "up";
}

/** The building Sprout walks into by moving `dir` from `pos`: only through its door, from the door tile. */
export function buildingEntered(pos, dir) {
  if (dir !== "up") return null;
  return BUILDINGS.find((b) => b.door.x === pos.x && b.door.y === pos.y) ?? null;
}

/**
 * One step. Returns { pos, moved, enter } where `enter` is a building Sprout walked into through its door.
 * Bumping into anything else (tree, water, fence, wall) leaves Sprout where it is, just facing that way.
 */
export function step(pos, dir) {
  const next = add(pos, dir);
  if (isWalkable(next.x, next.y)) return { pos: next, moved: true, enter: null };
  return { pos, moved: false, enter: buildingEntered(pos, dir) };
}

/** Shortest walkable path from `from` to `to` (breadth-first). Excludes the start; null if unreachable. */
export function findPath(from, to) {
  if (!isWalkable(to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];
  const prev = new Map([[key(from), null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const dir of Object.keys(DIRS)) {
      const n = add(cur, dir);
      if (n.x < 0 || n.y < 0 || n.x >= COLS || n.y >= ROWS || prev.has(key(n)) || !isWalkable(n.x, n.y)) continue;
      prev.set(key(n), cur);
      if (n.x === to.x && n.y === to.y) {
        const path = [n];
        for (let p = cur; p && key(p) !== key(from); p = prev.get(key(p))) path.unshift(p);
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

/**
 * Where a tap should send Sprout. A walkable tile is the destination; a tree, pond or wall sends Sprout
 * to the closest reachable tile beside it. A building sends Sprout to its door.
 */
export function pathToward(from, target) {
  const place = placeAt(target.x, target.y);
  if (place?.door) return findPath(from, place.door);
  if (isWalkable(target.x, target.y)) return findPath(from, target);
  let best = null;
  for (const dir of Object.keys(DIRS)) {
    const n = add(target, dir);
    const p = isWalkable(n.x, n.y) ? findPath(from, n) : null;
    if (p && (!best || p.length < best.length)) best = p;
  }
  return best;
}

/** What's directly in front of Sprout, for the interact button: a building, the plot, or nothing. */
export function facingPlace(pos, dir) {
  const front = add(pos, dir);
  return placeAt(front.x, front.y);
}

/** Where Sprout is, in plain words, for the guide. */
export function describeSpot(pos) {
  const door = BUILDINGS.find((b) => b.door.x === pos.x && b.door.y === pos.y);
  if (door) return `at the door of the ${door.name}`.replace("the Home", "Home");
  const near = BUILDINGS.map((b) => ({ b, d: Math.abs(b.door.x - pos.x) + Math.abs(b.door.y - pos.y) })).sort((a, b) => a.d - b.d)[0];
  if (near.d <= 2) return `near the ${near.b.name}`.replace("the Home", "Home");
  const byPlot = pos.x >= PLOT.x - 1 && pos.x <= PLOT.x + PLOT.w && pos.y >= PLOT.y - 1 && pos.y <= PLOT.y + PLOT.h;
  if (byPlot) return "by your garden plot";
  if (tileAt(pos.x, pos.y) === ",") return "in the tall grass";
  const byWater = Object.keys(DIRS).some((d) => {
    const n = add(pos, d);
    return tileAt(n.x, n.y) === "~";
  });
  if (byWater) return "by the pond";
  if (tileAt(pos.x, pos.y) === "=") return "on the path";
  return "on the grass";
}
