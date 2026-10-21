// The Debt Blob: an original 24 x 24 slime, one per debt. High-interest debts (8% APR or more) grow
// thorns, like the garden's brambles. Poses: "idle", "hit" (eyes squeezed shut) and "calm" (a debt
// the survey shows at $0: it relaxes and smiles).

import { blank, ellipse, line, outline, px, shade, toRows } from "../world/paint";

const COLORS = ["#9b7ab8", "#6fa8a0", "#d99a6c", "#7d9cc7", "#b88aa0"];
const darken = (hex, f) => `#${[1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)).toString(16).padStart(2, "0")).join("")}`;

export function debtBlobArt(index, { thorny = false, state = "idle" } = {}) {
  const body = COLORS[index % COLORS.length];
  const g = blank(24, 24);
  // A soft, slightly lopsided slime with a drip.
  ellipse(g, 12, 15.5, 9.5, 7, "b");
  ellipse(g, 9, 10.5, 5, 4, "b");
  ellipse(g, 15, 11, 4.5, 3.6, "b");
  px(g, 5, 21, "b");
  px(g, 5, 22, "b");
  if (thorny) {
    // Thorns along the top: sharper debts, like brambles.
    [[6, 6], [10, 4], [15, 5], [19, 8], [21, 13], [3, 13]].forEach(([x, y]) => {
      px(g, x, y, "t");
      px(g, x, y + 1, "t");
      px(g, x + 1, y + 1, "t");
      px(g, x, y + 2, "t");
      px(g, x + 1, y + 2, "t");
    });
  }
  shade(g, { b: ["l", "d"] });
  outline(g);
  // Face.
  if (state === "hit") {
    line(g, 8, 14, 10, 14, "k");
    line(g, 14, 14, 16, 14, "k");
  } else {
    px(g, 9, 13, "w");
    px(g, 9, 14, "k");
    px(g, 15, 13, "w");
    px(g, 15, 14, "k");
  }
  if (state === "calm") {
    px(g, 11, 17, "k");
    px(g, 12, 18, "k");
    px(g, 13, 17, "k");
    px(g, 7, 16, "p");
    px(g, 17, 16, "p");
  } else if (state === "hit") {
    px(g, 11, 18, "k");
    px(g, 12, 18, "k");
    px(g, 13, 18, "k");
  } else {
    // A flat, stubborn little mouth.
    line(g, 11, 17, 13, 17, "k");
  }
  return {
    rows: toRows(g),
    palette: { o: "#2a3a2e", b: body, l: darken(body, 1.18), d: darken(body, 0.78), t: "#6b4632", k: "#1d2a21", w: "#ffffff", p: "#f08aa0" },
  };
}
