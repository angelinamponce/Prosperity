// Original 24 x 24 pixel art for the Garden Dex: one plant per money word, plus the seed packet shown
// for words not learned yet. Painted from simple shapes with the town's shading and outline. Yellow
// appears only inside the art (sunflower, centers, the vine's buds).

import { blank, ellipse, line, outline, px, rect, shade, toRows } from "./paint";

export const DEX_PALETTE = {
  o: "#2a3a2e",
  g: "#6fbf5f", G: "#3f8a4f", l: "#a8dc8f", // leaves
  s: "#5fa97a", S: "#3d8a5a", // stems
  b: "#8b6a45", B: "#6b4f32", // bark
  d: "#7a5a3c", D: "#5f4630", // soil
  m: "#c27b52", M: "#9a5a38", // terracotta pot
  y: "#f4cf55", Y: "#d9a93a", // yellow (art only)
  p: "#f08aa0", P: "#c9667e", // pink
  w: "#fbfbf5", W: "#d6dacb", // white
  r: "#e06a4e", R: "#b84a32", // red
  u: "#9fd3e3", U: "#5d9ab0", // water
  v: "#b89ad6", V: "#8a6db0", // violet
  n: "#6b7a3a", x: "#8a5a44", // bramble cane and thorns
  c: "#7fbf6a", C: "#4f8f45", // cactus
  e: "#e8964a", E: "#c26f2f", // pumpkin
  h: "#3f7d5a", H: "#2b5a40", // pine
  z: "#a9cf72", Z: "#76a04a", // bamboo
  j: "#5a6fae", // berries
  t: "#e9dfc6", T: "#c9b994", // seed packet paper
  k: "#1d2a21",
};

const LEAF = { g: ["l", "G"], s: ["s", "S"], b: ["b", "B"], d: ["d", "D"], m: ["m", "M"], y: ["y", "Y"], p: ["p", "P"], w: ["w", "W"], r: ["r", "R"], u: ["u", "U"], v: ["v", "V"], c: ["c", "C"], e: ["e", "E"], h: ["h", "H"], z: ["z", "Z"], t: ["t", "T"] };

const sprite = (draw) => {
  const g = blank(24, 24);
  draw(g);
  shade(g, LEAF);
  outline(g);
  return toRows(g);
};

const mound = (g, w = 7) => ellipse(g, 12, 21.5, w, 2, "d");
const pot = (g) => {
  rect(g, 7, 17, 10, 5, "m");
  rect(g, 6, 16, 12, 2, "m");
};

export const DEX_ART = {
  netWorth: sprite((g) => {
    mound(g, 6);
    line(g, 12, 21, 12, 8, "s");
    ellipse(g, 7, 9, 4.5, 2.6, "g"); // the frond that holds what you own
    ellipse(g, 17, 9, 4.5, 2.6, "g"); // and what you owe, level with it
    line(g, 4, 9, 20, 9, "S");
    ellipse(g, 12, 6, 1.8, 1.8, "l");
  }),

  healthScore: sprite((g) => {
    mound(g, 5);
    line(g, 12, 21, 12, 11, "s");
    ellipse(g, 8.5, 15, 3, 1.6, "g");
    ellipse(g, 15.5, 13, 3, 1.6, "g");
    ellipse(g, 12, 7, 6, 6, "y");
    ellipse(g, 12, 7, 2.6, 2.6, "b");
  }),

  savingsRate: sprite((g) => {
    mound(g, 6);
    line(g, 10, 21, 13, 3, "s");
    ellipse(g, 15, 7, 3, 1.6, "g");
    ellipse(g, 8, 11, 3, 1.6, "g");
    ellipse(g, 15, 15, 3, 1.6, "g");
    ellipse(g, 7.5, 16, 1.2, 3, "l"); // bean pods
    ellipse(g, 17, 10, 1.2, 3, "l");
  }),

  emergencyFund: sprite((g) => {
    rect(g, 10, 13, 4, 8, "b");
    line(g, 9, 21, 7, 22, "b");
    line(g, 14, 21, 17, 22, "b");
    ellipse(g, 12, 8, 9, 6.5, "g");
    ellipse(g, 7, 11, 4, 3, "g");
    ellipse(g, 17, 11, 4, 3, "g");
  }),

  surplus: sprite((g) => {
    mound(g, 6);
    line(g, 12, 21, 12, 12, "s");
    // Four round leaves with gaps between them; the lighter fourth is the spare.
    ellipse(g, 8, 8, 3, 3, "g");
    ellipse(g, 16, 8, 3, 3, "g");
    ellipse(g, 8, 14.5, 3, 3, "g");
    ellipse(g, 16, 14.5, 3, 3, "l");
    rect(g, 11, 4, 2, 15, ".");
    rect(g, 4, 11, 16, 1, ".");
    line(g, 12, 12, 12, 21, "s");
  }),

  flexible: sprite((g) => {
    rect(g, 11, 12, 3, 9, "b");
    ellipse(g, 12, 6, 7, 4, "g");
    for (let x = 6; x <= 18; x += 3) line(g, x, 8, x + (x < 12 ? -2 : 2), 17, "s"); // drooping fronds
  }),

  payoffOrder: sprite((g) => {
    mound(g, 8);
    ellipse(g, 12, 15, 9, 5.5, "g");
    ellipse(g, 7, 12, 3, 3, "w");
    ellipse(g, 13, 10, 3.4, 3.4, "w");
    ellipse(g, 17.5, 14, 2.6, 2.6, "w");
    ellipse(g, 9.5, 17, 2.2, 2.2, "w");
  }),

  apr: sprite((g) => {
    mound(g, 7);
    line(g, 6, 21, 8, 5, "n");
    line(g, 12, 21, 13, 3, "n");
    line(g, 18, 21, 16, 6, "n");
    line(g, 8, 12, 13, 9, "n");
    ellipse(g, 15, 11, 2, 1.3, "g");
    [[7, 9], [9, 15], [12, 7], [14, 13], [17, 9], [16, 16], [11, 18]].forEach(([x, y]) => px(g, x, y, "x"));
  }),

  match: sprite((g) => {
    mound(g, 7);
    line(g, 8, 21, 8, 10, "s");
    line(g, 16, 21, 16, 10, "s");
    ellipse(g, 6, 16, 2.4, 1.3, "g");
    ellipse(g, 18, 16, 2.4, 1.3, "g");
    rect(g, 6, 5, 5, 5, "p");
    rect(g, 14, 5, 5, 5, "p");
    px(g, 7, 4, "p");
    px(g, 9, 4, "p");
    px(g, 15, 4, "p");
    px(g, 17, 4, "p");
  }),

  investOptions: sprite((g) => {
    rect(g, 2, 17, 5, 5, "m");
    rect(g, 9, 15, 6, 7, "m");
    rect(g, 17, 13, 6, 9, "m");
    ellipse(g, 4.5, 15, 2, 1.6, "g"); // small and steady
    ellipse(g, 12, 11.5, 3, 3, "g"); // middling
    ellipse(g, 20, 7, 3.4, 5, "g"); // biggest growth
  }),

  simulation: sprite((g) => {
    mound(g, 9);
    [[5, 12, 3], [10, 8, 2.6], [15, 11, 3], [19, 7, 2.4]].forEach(([x, y, r]) => {
      line(g, x, 21, x, y + 2, "s");
      ellipse(g, x, y, r, r, "w");
      px(g, x, y, "y");
    });
  }),

  fi: sprite((g) => {
    rect(g, 11, 18, 2, 4, "b");
    ellipse(g, 12, 15, 7, 3, "h");
    ellipse(g, 12, 10.5, 5.5, 2.8, "h");
    ellipse(g, 12, 6.5, 4, 2.4, "h");
    ellipse(g, 12, 3.5, 2, 1.6, "h");
  }),

  budget: sprite((g) => {
    rect(g, 1, 20, 22, 2, "d");
    [4, 10, 16, 21].forEach((x) => {
      ellipse(g, x, 17, 2.6, 2.6, "g");
      ellipse(g, x, 16, 1.4, 1.4, "l");
    });
    [7, 13, 19].forEach((x) => ellipse(g, x, 11, 2.4, 2.4, "g"));
  }),

  needsWants: sprite((g) => {
    ellipse(g, 12, 13, 9, 1.4, "d");
    rect(g, 3, 13, 18, 1, "d");
    ellipse(g, 12, 18, 2.2, 4.5, "e"); // the root, below ground
    line(g, 12, 13, 12, 6, "s");
    ellipse(g, 9, 9, 2.4, 1.3, "g");
    ellipse(g, 12, 4, 3, 3, "p"); // the bloom
    px(g, 12, 4, "y");
  }),

  rule503020: sprite((g) => {
    ellipse(g, 12, 15, 10, 6.5, "e");
    line(g, 12, 9, 12, 21, "E"); // 50 / 30 / 20 sections
    line(g, 17, 10, 17, 20, "E");
    rect(g, 11, 6, 2, 3, "s");
    ellipse(g, 15, 6, 2.4, 1.3, "g");
  }),

  payYourselfFirst: sprite((g) => {
    mound(g, 7);
    ellipse(g, 12, 15, 4.2, 4.2, "r");
    line(g, 12, 19, 12, 21, "w");
    line(g, 12, 11, 12, 6, "s");
    ellipse(g, 9, 6, 2.4, 3, "g");
    ellipse(g, 15, 6, 2.4, 3, "g");
  }),

  minimumPayment: sprite((g) => {
    ellipse(g, 12, 19, 10, 3.2, "g");
    ellipse(g, 8, 17, 3.5, 2, "g");
    ellipse(g, 16, 17, 3.5, 2, "g");
    // Thin spore stalks with brown caps: moss, creeping along.
    [[6, 11], [10, 9], [14, 12], [18, 10]].forEach(([x, y]) => {
      line(g, x, 16, x, y + 1, "s");
      px(g, x, y, "b");
    });
  }),

  compoundInterest: sprite((g) => {
    mound(g, 5);
    line(g, 12, 21, 12, 17, "s");
    // Loops that get bigger as the vine climbs.
    ellipse(g, 12, 15, 2, 2, "s");
    ellipse(g, 12, 15, 1, 1, ".");
    ellipse(g, 11, 10.5, 3, 3, "s");
    ellipse(g, 11, 10.5, 2, 2, ".");
    ellipse(g, 13, 4.5, 4.5, 4, "s");
    ellipse(g, 13, 4.5, 3.4, 2.8, ".");
    ellipse(g, 15, 14, 2, 1.2, "g");
    ellipse(g, 7, 9, 2, 1.2, "g");
    px(g, 17, 3, "y");
    px(g, 9, 4, "y");
  }),

  creditScore: sprite((g) => {
    mound(g, 5);
    [9, 14].forEach((x) => {
      rect(g, x, 3, 3, 18, "z");
      [7, 12, 17].forEach((y) => rect(g, x, y, 3, 1, "Z"));
    });
    ellipse(g, 7, 5, 2.4, 1.2, "g");
    ellipse(g, 19, 9, 2.4, 1.2, "g");
  }),

  creditUtilization: sprite((g) => {
    pot(g);
    ellipse(g, 12, 9, 4, 7.5, "c");
    ellipse(g, 6.5, 10, 2, 3, "c");
    ellipse(g, 17.5, 8, 2, 3, "c");
    line(g, 12, 4, 12, 14, "C");
    px(g, 12, 2, "p"); // a flower on top
    px(g, 11, 2, "p");
  }),

  inflation: sprite((g) => {
    mound(g, 5);
    line(g, 12, 21, 12, 11, "s");
    ellipse(g, 9, 17, 2.6, 1.2, "g");
    ellipse(g, 12, 8, 4.5, 4.5, "w");
    [[6, 3], [18, 2], [20, 6], [4, 7]].forEach(([x, y]) => {
      px(g, x, y, "w");
      px(g, x, y + 1, "W");
    });
  }),

  indexFund: sprite((g) => {
    ellipse(g, 12, 19, 11, 3.5, "g");
    [[3, 16, "p"], [7, 14, "y"], [11, 16, "w"], [14, 13, "v"], [18, 15, "p"], [21, 17, "y"], [5, 19, "v"], [16, 19, "w"], [9, 19, "r"]].forEach(([x, y, c]) => {
      ellipse(g, x, y, 1.6, 1.6, c);
    });
  }),

  diversification: sprite((g) => {
    mound(g, 8);
    ellipse(g, 12, 13, 9.5, 7.5, "g");
    [[7, 10], [12, 8], [17, 11], [9, 15], [15, 16], [12, 13], [5, 14], [19, 15]].forEach(([x, y]) => {
      px(g, x, y, "j");
      px(g, x + 1, y, "j");
      px(g, x, y + 1, "j");
    });
  }),

  hysa: sprite((g) => {
    ellipse(g, 12, 17, 11, 5, "u");
    ellipse(g, 8, 17, 4, 2, "g");
    ellipse(g, 16, 18, 3.5, 1.8, "g");
    ellipse(g, 13, 13, 3.5, 3, "p");
    ellipse(g, 13, 12, 1.5, 1.2, "w");
  }),
};

/** The packet shown for a word that hasn't been learned yet. */
export const SEED_PACKET = (() => {
  const g = blank(24, 24);
  rect(g, 6, 3, 12, 18, "t");
  rect(g, 6, 3, 12, 2, "T");
  ellipse(g, 12, 13, 3.5, 3.5, "g");
  line(g, 12, 16, 12, 18, "s");
  shade(g, LEAF);
  outline(g);
  return toRows(g);
})();
