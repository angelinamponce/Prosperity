// The Garden scene: your plot, up close. Like the town, one character per 16px tile on a 24 x 15 map.
//   T tree (hedge)   . grass   = path   s soil (beds and the flower border)
// What grows here comes from deriveGarden (game/garden.js): weeds for debt, crops for soil richness,
// flowers for money words, the greenhouse for the emergency fund, visitors for the health score.

export const GARDEN_MAP = [
  "TTTTTTTTTTTTTTTTTTTTTTTT",
  "T......................T",
  "T......ssssssssss......T",
  "T......ssssssssss......T",
  "T......................T",
  "T......ssssssssss......T",
  "T......ssssssssss......T",
  "T.....=============....T",
  "T......ssssssssss.=....T",
  "T......ssssssssss.=....T",
  "T.................=....T",
  "T.ssssssssssss....=....T",
  "T.ssssssssssss....=....T",
  "T.................=....T",
  "TTTTTTTTTTTTTTTTTT=TTTTT",
];

const COLS = GARDEN_MAP[0].length;
const ROWS = GARDEN_MAP.length;
const tileAt = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? "T" : GARDEN_MAP[y][x]);

// Three vegetable beds, top to bottom, and the flower border along the bottom left.
export const BEDS = [
  { x: 7, y: 2, w: 10, h: 2 },
  { x: 7, y: 5, w: 10, h: 2 },
  { x: 7, y: 8, w: 10, h: 2 },
];
export const BORDER = { x: 2, y: 11, w: 12, h: 2 };
export const GREENHOUSE = { id: "greenhouse", name: "Greenhouse", x: 19, y: 2, w: 4, h: 4, door: { x: 20, y: 6 } };
export const SIGN = { id: "season", name: "Season sign", x: 20, y: 9 };
export const VISITOR_SPOT = { x: 3, y: 8, w: 4, h: 2 };
export const GATE = { x: 18, y: 14 };
export const GARDEN_SPAWN = { x: 18, y: 13 };

const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Bed tiles in planting order: top bed first, left to right, then the next row and the next bed. */
export const BED_TILES = BEDS.flatMap((b) => Array.from({ length: b.w * b.h }, (_, i) => ({ x: b.x + (i % b.w), y: b.y + Math.floor(i / b.w) })));
export const BORDER_TILES = Array.from({ length: BORDER.w * BORDER.h }, (_, i) => ({ x: BORDER.x + (i % BORDER.w), y: BORDER.y + Math.floor(i / BORDER.w) }));

function placeAt(x, y) {
  if (inRect(GREENHOUSE, x, y)) return GREENHOUSE;
  if (x === SIGN.x && y === SIGN.y) return SIGN;
  if (BEDS.some((b) => inRect(b, x, y))) return { id: "bed", x, y };
  if (inRect(BORDER, x, y)) return { id: "flowers", x, y };
  return null;
}

function isWalkable(x, y) {
  const t = tileAt(x, y);
  if (t === "T" || t === "s") return false;
  return !inRect(GREENHOUSE, x, y) && !(x === SIGN.x && y === SIGN.y);
}

/** Where Sprout is in the garden, in plain words. */
function describe(pos) {
  if (pos.x === GATE.x && pos.y === GATE.y) return "at the gate back to town";
  if (pos.x === GREENHOUSE.door.x && pos.y === GREENHOUSE.door.y) return "at the greenhouse door";
  if (Math.abs(pos.x - SIGN.x) + Math.abs(pos.y - SIGN.y) <= 1) return "by the season sign";
  if (pos.y >= BORDER.y - 1 && pos.x <= BORDER.x + BORDER.w) return "by the flower border";
  if (BEDS.some((b) => pos.x >= b.x - 1 && pos.x <= b.x + b.w && pos.y >= b.y - 1 && pos.y <= b.y + b.h)) return "beside the vegetable beds";
  return "in the garden";
}

/** The Garden scene as a world the movement engine can walk around. */
export const GARDEN = { id: "garden", cols: COLS, rows: ROWS, tileAt, isWalkable, placeAt, places: [GREENHOUSE], describe };

const FLOWER_COLORS = ["pink", "sun", "white", "lilac"];

/**
 * Lays the derived garden out on the map. Weed patches fill bed tiles in planting order, each debt's
 * patches together; every other bed tile grows a crop whose size follows the soil. The border has one
 * spot per money word: learned words bloom, the rest are seedlings waiting their turn.
 */
export function layoutGarden(garden) {
  const patches = [];
  garden.byId.weeds.weeds.forEach((w, debt) => {
    for (let k = 0; k < w.patches; k += 1) patches.push({ debt, k, thorny: w.thorny, first: k === 0 });
  });
  const placed = patches.slice(0, BED_TILES.length).map((p, i) => ({ ...p, ...BED_TILES[i] }));
  const crops = BED_TILES.slice(placed.length).map((t) => ({ ...t, tier: garden.byId.soil.state }));
  const learned = garden.byId.flowers.state;
  const flowers = BORDER_TILES.map((t, i) => ({ ...t, bloom: i < learned, color: FLOWER_COLORS[i % FLOWER_COLORS.length] }));
  return { weeds: placed, crops, flowers, overflow: Math.max(0, patches.length - BED_TILES.length) };
}

/** Which garden element a tile belongs to, for taps and the A button. */
export function elementAt(layout, x, y) {
  const place = placeAt(x, y);
  if (!place) return null;
  if (place.id === "bed") {
    const weed = layout.weeds.find((w) => w.x === x && w.y === y);
    return weed ? { id: "weeds", debt: weed.debt } : { id: "soil" };
  }
  return { id: place.id };
}
