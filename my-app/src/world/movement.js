// How Sprout moves around a world (the town or the garden): one tile at a time, never through anything
// solid. A world is { cols, rows, tileAt, isWalkable, placeAt, places, describe }; places with a `door`
// can be entered by walking up through it. Pure functions, so collisions and paths are easy to test.

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

/** The place Sprout walks into by moving `dir` from `pos`: only through its door, walking up. */
export function buildingEntered(world, pos, dir) {
  if (dir !== "up") return null;
  return world.places.find((p) => p.door && p.door.x === pos.x && p.door.y === pos.y) ?? null;
}

/**
 * One step. Returns { pos, moved, enter } where `enter` is a place Sprout walked into through its door.
 * Bumping into anything else (tree, water, fence, wall) leaves Sprout where it is, just facing that way.
 */
export function step(world, pos, dir) {
  const next = add(pos, dir);
  if (world.isWalkable(next.x, next.y)) return { pos: next, moved: true, enter: null };
  return { pos, moved: false, enter: buildingEntered(world, pos, dir) };
}

/** Shortest walkable path from `from` to `to` (breadth-first). Excludes the start; null if unreachable. */
export function findPath(world, from, to) {
  if (!world.isWalkable(to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];
  const prev = new Map([[key(from), null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const dir of Object.keys(DIRS)) {
      const n = add(cur, dir);
      if (n.x < 0 || n.y < 0 || n.x >= world.cols || n.y >= world.rows || prev.has(key(n)) || !world.isWalkable(n.x, n.y)) continue;
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
 * Where a tap should send Sprout. A walkable tile is the destination; a place with a door sends Sprout to
 * its door; anything else solid sends Sprout to the closest reachable tile beside it.
 */
export function pathToward(world, from, target) {
  const place = world.placeAt(target.x, target.y);
  if (place?.door) return findPath(world, from, place.door);
  if (world.isWalkable(target.x, target.y)) return findPath(world, from, target);
  let best = null;
  for (const dir of Object.keys(DIRS)) {
    const n = add(target, dir);
    const p = world.isWalkable(n.x, n.y) ? findPath(world, from, n) : null;
    if (p && (!best || p.length < best.length)) best = p;
  }
  return best;
}

/** What's directly in front of Sprout, for the interact button. */
export function facingPlace(world, pos, dir) {
  const front = add(pos, dir);
  return world.placeAt(front.x, front.y);
}
