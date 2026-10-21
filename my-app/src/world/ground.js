// Paints the town's ground (grass, paths, water, fences, trees) onto a canvas, one 16px tile at a time.
// Everything is drawn from code with a fixed noise pattern, so it looks the same on every load.
// Where two kinds of ground meet, the edge is jagged and dithered rather than a straight line.

import { MAP_H, MAP_W, TILE, TOWN } from "./town";

const P = {
  grass: "#7cbb6e",
  grassDark: "#6aa95f",
  grassLight: "#9fd07f",
  tall: "#5fa165",
  tallBlade: "#4c8c55",
  tallTip: "#8fc77a",
  path: "#ddc08e",
  pathDark: "#c9a774",
  pathLight: "#e8d3a6",
  pathRim: "#bfa06e",
  water: "#7cc4d8",
  waterDeep: "#5fb0c8",
  waterLight: "#a8dcea",
  foam: "#b9e3ee",
  soil: "#8b6a45",
  soilDark: "#7a5c3b",
  soilLight: "#a07f52",
  wood: "#8a6a48",
  woodDark: "#6b5238",
  leafDark: "#3f7a46",
  leaf: "#4f8f4f",
  leafLight: "#6aaa5e",
  shadow: "rgba(30, 60, 35, 0.22)",
  pink: "#f08aa0",
  sun: "#f4cf55", // art only
  white: "#ffffff",
};

// A small, stable hash: the same tile and pixel always get the same "random" value.
export function noise(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Which kinds of ground count as the same surface when deciding where edges go.
const GROUP = { ".": "green", ",": "green", "*": "green", T: "green", "#": "green", "=": "path", "~": "water", s: "soil" };
export const groupOf = (ch) => GROUP[ch] ?? "green";

/** Which sides of a tile touch a different kind of ground: { n, e, s, w }. */
export function edgesOf(x, y, tileAt = TOWN.tileAt) {
  const g = groupOf(tileAt(x, y));
  const differs = (dx, dy) => groupOf(tileAt(x + dx, y + dy)) !== g;
  return { n: differs(0, -1), e: differs(1, 0), s: differs(0, 1), w: differs(-1, 0) };
}

// The town's outer ring is trees, so up to this many art pixels may be cropped at each edge.
export const MAX_CROP = 12;

/**
 * The display scale. Pixel art stays crisp when every art pixel covers a whole number of device pixels,
 * so in order of preference:
 *   1. the next crisp step up, if it only crops a little of the tree border at the edges;
 *   2. the crisp step down, if it keeps at least 90% of the size;
 *   3. otherwise, exactly fill the space (slightly uneven pixels, but no wasted screen).
 */
export function pixelScale(width, height, dpr = 1) {
  const fit = Math.min(width / MAP_W, height / MAP_H);
  if (fit <= 0) return 1;
  const up = Math.ceil(fit * dpr - 1e-9) / dpr;
  const cropX = (MAP_W * up - width) / 2 / up;
  const cropY = (MAP_H * up - height) / 2 / up;
  if (cropX <= MAX_CROP && cropY <= MAX_CROP) return up;
  const down = Math.floor(fit * dpr) / dpr;
  return down >= fit * 0.9 ? down : fit;
}

function paintTile(px, x, y, ch, tileAt) {
  const ox = x * TILE;
  const oy = y * TILE;
  const dot = (dx, dy, c) => px(ox + dx, oy + dy, c);
  const each = (fn) => {
    for (let dy = 0; dy < TILE; dy += 1) for (let dx = 0; dx < TILE; dx += 1) fn(dx, dy, noise(ox + dx, oy + dy));
  };
  const grass = () =>
    each((dx, dy, n) => dot(dx, dy, n < 0.07 ? P.grassDark : n > 0.965 ? P.grassLight : P.grass));

  switch (ch) {
    case "=": {
      each((dx, dy, n) => dot(dx, dy, n < 0.09 ? P.pathDark : n > 0.95 ? P.pathLight : P.path));
      // Grass creeps onto the path in a jagged, dithered band wherever the two meet.
      const e = edgesOf(x, y, tileAt);
      const side = (len, at) => {
        for (let i = 0; i < len; i += 1) {
          const depth = 1 + Math.floor(noise(ox + i, oy + i, 7) * 3); // 1 to 3 px
          for (let d = 0; d < depth; d += 1) at(i, d, d === depth - 1 && noise(ox + i, oy + d, 3) < 0.5 ? P.grassDark : P.grass);
          at(i, depth, P.pathRim);
        }
      };
      if (e.n) side(TILE, (i, d, c) => dot(i, d, c));
      if (e.s) side(TILE, (i, d, c) => dot(i, TILE - 1 - d, c));
      if (e.w) side(TILE, (i, d, c) => dot(d, i, c));
      if (e.e) side(TILE, (i, d, c) => dot(TILE - 1 - d, i, c));
      break;
    }
    case "~": {
      each((dx, dy, n) => dot(dx, dy, n < 0.08 ? P.waterDeep : P.water));
      for (let dy = 3; dy < TILE; dy += 6) {
        const start = Math.floor(noise(ox, oy + dy, 5) * 8);
        for (let dx = start; dx < start + 5; dx += 1) dot(dx, dy, P.waterLight);
      }
      // A soft shoreline where water meets land: a light band, with the grass bank nibbling in here and there.
      const e = edgesOf(x, y, tileAt);
      const shore = (at) => {
        for (let i = 0; i < TILE; i += 1) {
          const bank = noise(ox + i, oy + i, 9) < 0.35 ? 2 : 1;
          for (let k = 0; k < bank; k += 1) at(i, k, P.grass);
          at(i, bank, P.foam);
          if (noise(ox + i, oy, 4) < 0.5) at(i, bank + 1, P.waterLight);
        }
      };
      if (e.n) shore((i, k, c) => dot(i, k, c));
      if (e.s) shore((i, k, c) => dot(i, TILE - 1 - k, c));
      if (e.w) shore((i, k, c) => dot(k, i, c));
      if (e.e) shore((i, k, c) => dot(TILE - 1 - k, i, c));
      break;
    }
    case ",": {
      each((dx, dy) => dot(dx, dy, P.tall));
      for (let dx = 0; dx < TILE; dx += 2) {
        const top = 2 + Math.floor(noise(ox + dx, oy, 11) * 6);
        for (let dy = top; dy < TILE; dy += 1) dot(dx, dy, P.tallBlade);
        dot(dx, top, P.tallTip);
        dot(dx + 1, top + 3, P.tallTip);
      }
      break;
    }
    case "*": {
      grass();
      [[3, 4], [10, 2], [6, 10], [12, 11]].forEach(([fx, fy], i) => {
        const c = i % 3 === 0 ? P.pink : i % 3 === 1 ? P.sun : P.white;
        dot(fx, fy - 1, c);
        dot(fx - 1, fy, c);
        dot(fx + 1, fy, c);
        dot(fx, fy + 1, c);
        dot(fx, fy, P.sun);
        dot(fx, fy + 2, P.leafDark);
      });
      break;
    }
    case "s": {
      each((dx, dy, n) => dot(dx, dy, dy % 4 === 3 ? P.soilDark : n > 0.93 ? P.soilLight : P.soil));
      break;
    }
    case "#": {
      grass();
      const h = tileAt(x - 1, y) === "#" || tileAt(x + 1, y) === "#";
      const v = tileAt(x, y - 1) === "#" || tileAt(x, y + 1) === "#";
      if (h) for (let dx = 0; dx < TILE; dx += 1) { dot(dx, 6, P.wood); dot(dx, 11, P.wood); dot(dx, 12, P.woodDark); }
      if (v) for (let dy = 0; dy < TILE; dy += 1) { dot(6, dy, P.wood); dot(9, dy, P.wood); dot(10, dy, P.woodDark); }
      for (let dy = 3; dy < 15; dy += 1) for (let dx = 6; dx < 10; dx += 1) dot(dx, dy, dx === 9 ? P.woodDark : P.wood);
      dot(6, 3, P.woodDark);
      dot(9, 3, P.woodDark);
      break;
    }
    case "T": {
      grass();
      for (let dy = 12; dy < 16; dy += 1) for (let dx = 3; dx < 14; dx += 1) if ((dx - 8) ** 2 / 30 + (dy - 14) ** 2 / 3 < 1) dot(dx, dy, P.shadow);
      for (let dy = 9; dy < 15; dy += 1) { dot(7, dy, P.woodDark); dot(8, dy, P.wood); }
      for (let dy = 0; dy < 12; dy += 1) {
        for (let dx = 0; dx < TILE; dx += 1) {
          const r = (dx - 7.5) ** 2 + (dy - 6) ** 2;
          if (r < 46) {
            const lit = dx + dy < 11 && r < 30;
            dot(dx, dy, lit ? P.leafLight : r > 34 || dx + dy > 18 ? P.leafDark : P.leaf);
          }
        }
      }
      break;
    }
    default:
      grass();
  }
}

/** Paints a world's ground at 1 canvas pixel per art pixel. Scaling up happens when it's shown. */
export function drawGround(ctx, world = TOWN) {
  const px = (x, y, c) => {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  };
  for (let y = 0; y < world.rows; y += 1) for (let x = 0; x < world.cols; x += 1) paintTile(px, x, y, world.tileAt(x, y), world.tileAt);
}
