// Sprout's town: the Garden mode map. One character per 16px tile; 24 x 15 tiles is exactly the
// world screen's 16:10 shape. Buildings stand on grass tiles and are drawn on top as their own elements.
//
//   T tree   . grass   , tall grass   = path   ~ water   * flowers   # fence   s garden soil

export const TILE = 16;

export const MAP = [
  "TTTTTTTTTTTTTTTTTTTTTTTT",
  "T*.........==.........*T",
  "T......####==..........T",
  "T......#ss#==..........T",
  "T......#ss#==..........T",
  "T..=...#=##==...=....=.T",
  "T~~=....=..==...=....=.T",
  "T~~====================T",
  "T~~*.......==.......*..T",
  "T..........==..........T",
  "T..........==..........T",
  "T..........==..........T",
  "T.=====================T",
  "T.,,,,,,,,.==.,,,,,,,..T",
  "TTTTTTTTTTTTTTTTTTTTTTTT",
];

export const COLS = MAP[0].length;
export const ROWS = MAP.length;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;

export const tileAt = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? "T" : MAP[y][x]);

/**
 * Buildings: footprint (x, y, w, h) in tiles, the path tile in front of the door, and where entering takes
 * the player. Each one opens a feature that already exists, so nothing in town is a dead end.
 */
export const BUILDINGS = [
  { id: "home", kind: "home", name: "Home", x: 2, y: 2, w: 4, h: 3, door: { x: 3, y: 5 }, opens: "Your dashboard", go: "" },
  { id: "library", kind: "library", name: "Library", x: 15, y: 2, w: 4, h: 3, door: { x: 16, y: 5 }, opens: "Garden Dex: money words", go: "garden?scene=dex" },
  { id: "toolshed", kind: "toolshed", name: "Toolshed", x: 20, y: 3, w: 3, h: 2, door: { x: 21, y: 5 }, opens: "Debt planner", go: "debt" },
  { id: "gh-budgeting", kind: "greenhouse", topic: "budgeting", name: "Budgeting Greenhouse", x: 4, y: 10, w: 3, h: 2, door: { x: 5, y: 12 }, opens: "Budgeting quiz battle", go: "battle?topic=budgeting&from=garden" },
  { id: "gh-debt", kind: "greenhouse", topic: "debt", name: "Debt Greenhouse", x: 7, y: 10, w: 3, h: 2, door: { x: 8, y: 12 }, opens: "Debt quiz battle", go: "battle?topic=debt&from=garden" },
  { id: "gh-saving", kind: "greenhouse", topic: "saving", name: "Saving Greenhouse", x: 14, y: 10, w: 3, h: 2, door: { x: 15, y: 12 }, opens: "Saving quiz battle", go: "battle?topic=saving&from=garden" },
  { id: "gh-investing", kind: "greenhouse", topic: "investing", name: "Investing Greenhouse", x: 17, y: 10, w: 3, h: 2, door: { x: 18, y: 12 }, opens: "Investing quiz battle", go: "battle?topic=investing&from=garden" },
  { id: "weather", kind: "weather", name: "Weather Station", x: 21, y: 9, w: 2, h: 3, door: { x: 21, y: 12 }, opens: "Possible futures", go: "future" },
];

// The fenced plot by Home. Its contents come from the player's real numbers (Phase 8 grows it on the map).
// Walking up through its gate enters the Garden scene.
export const PLOT = { id: "plot", name: "Your garden plot", x: 7, y: 2, w: 4, h: 4, gate: { x: 8, y: 5 }, door: { x: 8, y: 5 } };

// Where Sprout stands when Garden mode opens: on the path outside Home.
export const SPAWN = { x: 3, y: 6 };

const BLOCKING = new Set(["T", "~", "#", "s"]);

/** True if Sprout can stand on this tile: not a tree, water, fence, soil, or under a building. */
export function isWalkable(x, y) {
  if (BLOCKING.has(tileAt(x, y))) return false;
  return !BUILDINGS.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
}

/** The building (or the plot) whose footprint covers this tile, if any. */
export function placeAt(x, y) {
  return [...BUILDINGS, PLOT].find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) ?? null;
}

const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Where Sprout is in town, in plain words, for the guide. */
export function describeTownSpot(pos) {
  const door = BUILDINGS.find((b) => b.door.x === pos.x && b.door.y === pos.y);
  if (door) return `at the door of the ${door.name}`.replace("the Home", "Home");
  if (pos.x === PLOT.gate.x && pos.y === PLOT.gate.y) return "at the gate of your garden";
  const near = BUILDINGS.map((b) => ({ b, d: Math.abs(b.door.x - pos.x) + Math.abs(b.door.y - pos.y) })).sort((a, b) => a.d - b.d)[0];
  if (near.d <= 2) return `near the ${near.b.name}`.replace("the Home", "Home");
  const byPlot = pos.x >= PLOT.x - 1 && pos.x <= PLOT.x + PLOT.w && pos.y >= PLOT.y - 1 && pos.y <= PLOT.y + PLOT.h;
  if (byPlot) return "by your garden plot";
  if (tileAt(pos.x, pos.y) === ",") return "in the tall grass";
  if (DIRS4.some(([dx, dy]) => tileAt(pos.x + dx, pos.y + dy) === "~")) return "by the pond";
  if (tileAt(pos.x, pos.y) === "=") return "on the path";
  return "on the grass";
}

/** The town as a world the movement engine can walk around. */
export const TOWN = { id: "town", cols: COLS, rows: ROWS, tileAt, isWalkable, placeAt, places: [...BUILDINGS, PLOT], describe: describeTownSpot };
