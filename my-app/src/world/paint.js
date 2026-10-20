// A tiny pixel painter: build sprites from simple shapes, then give them the town's look with one shared
// shading pass (light top-left rim, darker bottom-right) and a 1px outline. Output is text-grid art for
// PixelArt. Pure, so every sprite can be checked in tests.

export const EMPTY = ".";

export function blank(w = 24, h = 24) {
  return Array.from({ length: h }, () => Array(w).fill(EMPTY));
}

const inside = (g, x, y) => y >= 0 && y < g.length && x >= 0 && x < g[0].length;

export function px(g, x, y, ch) {
  if (inside(g, x, y)) g[y][x] = ch;
}

/** Fills an ellipse centered on (cx, cy) with radii rx, ry (in pixels). */
export function ellipse(g, cx, cy, rx, ry, ch) {
  for (let y = 0; y < g.length; y += 1) {
    for (let x = 0; x < g[0].length; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) g[y][x] = ch;
    }
  }
}

export function rect(g, x, y, w, h, ch) {
  for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) px(g, i, j, ch);
}

/** A 1px line between two points. */
export function line(g, x0, y0, x1, y1, ch) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= steps; i += 1) px(g, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), ch);
}

/** Draws text-grid rows at (x, y); "." leaves what's underneath. */
export function stamp(g, x, y, rows) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== EMPTY && px(g, x + i, y + j, ch)));
}

/**
 * Rim light and shadow: for each pixel of a body color, an empty pixel up-left makes it the light shade;
 * an empty pixel below or to the right makes it the dark shade. `tones` maps body -> [light, dark].
 */
export function shade(g, tones) {
  const src = g.map((row) => row.slice());
  const empty = (x, y) => !inside(src, x, y) || src[y][x] === EMPTY;
  for (let y = 0; y < g.length; y += 1) {
    for (let x = 0; x < g[0].length; x += 1) {
      const t = tones[src[y][x]];
      if (!t) continue;
      if (empty(x + 1, y + 1) || empty(x, y + 1)) g[y][x] = t[1];
      else if (empty(x - 1, y - 1) && (empty(x - 1, y) || empty(x, y - 1))) g[y][x] = t[0];
    }
  }
}

/** Adds a 1px outline (4-neighbor) around everything drawn. */
export function outline(g, ch = "o") {
  const src = g.map((row) => row.slice());
  const filled = (x, y) => inside(src, x, y) && src[y][x] !== EMPTY;
  for (let y = 0; y < g.length; y += 1) {
    for (let x = 0; x < g[0].length; x += 1) {
      if (src[y][x] === EMPTY && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) g[y][x] = ch;
    }
  }
}

export const toRows = (g) => g.map((row) => row.join(""));
