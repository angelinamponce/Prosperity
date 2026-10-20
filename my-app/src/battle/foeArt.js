// The six Misconceptions, drawn as original 24 x 24 pixel art from simple shapes (see world/paint),
// shaded and outlined the same way as Sprout and the town. Each has three faces:
//   idle: watching you   hit: eyes squeezed shut   happy: befriended, ^ ^ eyes and a smile

import { blank, ellipse, line, outline, px, rect, shade, stamp, toRows } from "../world/paint";

const COMMON = { o: "#2a3a2e", k: "#1d2a21", w: "#ffffff", c: "#f4a38c" };

// Faces are 8 pixels wide, stamped onto the body.
const FACE = {
  idle: ["kw....kw", "kk....kk", "c..oo..c"],
  hit: ["........", "kk....kk", ".c.oo.c."],
  happy: [".k....k.", "k.k..k.k", "c.o..o.c", "...oo..."],
};

function gnat(state) {
  const g = blank();
  ellipse(g, 6, 9, 4.6, 3.2, "g");
  ellipse(g, 18, 9, 4.6, 3.2, "g");
  ellipse(g, 12, 14.5, 7, 6, "b");
  shade(g, { b: ["h", "B"], g: ["g", "G"] });
  stamp(g, 8, 13, FACE[state]);
  outline(g);
  line(g, 10, 8, 8, 3, "o");
  line(g, 14, 8, 16, 3, "o");
  rect(g, 7, 2, 2, 2, "o");
  rect(g, 16, 2, 2, 2, "o");
  px(g, 9, 21, "o");
  px(g, 15, 21, "o");
  return toRows(g);
}

function mite(state) {
  const g = blank();
  ellipse(g, 12, 13.5, 8, 6, "b");
  ellipse(g, 20.5, 16.5, 2.6, 2.6, "y"); // the one tiny coin it clings to
  shade(g, { b: ["h", "B"], y: ["y", "Y"] });
  stamp(g, 8, 12, FACE[state]);
  outline(g);
  // Six stubby legs underneath.
  [[6, 5], [9, 9], [12, 12]].forEach(([x0, x1]) => {
    line(g, x0, 20, x1, 22, "o");
    line(g, 24 - x0, 20, 24 - x1, 22, "o");
  });
  return toRows(g);
}

function imp(state) {
  const g = blank();
  stamp(g, 5, 4, ["r..", "rr.", "rrr", ".rr"]);
  stamp(g, 16, 4, ["..r", ".rr", "rrr", "rr."]);
  ellipse(g, 12, 14, 7.5, 7, "b");
  shade(g, { b: ["h", "B"], r: ["r", "R"] });
  stamp(g, 8, 13, state === "idle" ? ["kw....kw", "kk....kk", "c.oooo.c"] : FACE[state]);
  outline(g);
  line(g, 20, 17, 22, 15, "o"); // a curly tail
  px(g, 23, 14, "o");
  px(g, 22, 13, "o");
  rect(g, 8, 22, 3, 1, "o");
  rect(g, 13, 22, 3, 1, "o");
  return toRows(g);
}

function snail(state) {
  const g = blank();
  ellipse(g, 15, 11, 6.5, 6.5, "s");
  ellipse(g, 15, 11, 4, 4, "S");
  ellipse(g, 15, 11, 2.2, 2.2, "s");
  ellipse(g, 11, 19, 10.5, 2.8, "b");
  ellipse(g, 5, 15.5, 3.6, 4, "b");
  ellipse(g, 3.5, 5.5, 1.5, 1.5, "w");
  ellipse(g, 8.5, 5.5, 1.5, 1.5, "w");
  shade(g, { b: ["h", "B"], s: ["t", "S"] });
  px(g, 15, 11, "p");
  // Eyes on stalks: open, squeezed shut, or happy.
  if (state === "idle") {
    px(g, 3, 5, "k");
    px(g, 8, 5, "k");
  } else if (state === "hit") {
    rect(g, 2, 5, 3, 1, "k");
    rect(g, 7, 5, 3, 1, "k");
  } else {
    stamp(g, 2, 4, [".k.", "k.k"]);
    stamp(g, 7, 4, [".k.", "k.k"]);
  }
  stamp(g, 3, 16, state === "happy" ? ["o..o", ".oo."] : [".oo."]);
  px(g, 7, 15, "c");
  outline(g);
  line(g, 4, 8, 4, 12, "o");
  line(g, 8, 8, 7, 12, "o");
  return toRows(g);
}

function hornet(state) {
  const g = blank();
  ellipse(g, 7.5, 7.5, 4.2, 3, "g");
  ellipse(g, 16.5, 7.5, 4.2, 3, "g");
  ellipse(g, 12, 14.5, 6.5, 7, "b");
  shade(g, { b: ["h", "B"], g: ["g", "G"] });
  // Stripes across the lower body.
  for (const y of [16, 19]) for (let x = 0; x < 24; x += 1) if ("bhB".includes(g[y][x])) g[y][x] = "z";
  stamp(g, 8, 11, state === "idle" ? ["kw....kw", "kk....kk", ".c.oo.c."] : FACE[state]);
  outline(g);
  line(g, 10, 7, 9, 3, "o");
  line(g, 14, 7, 15, 3, "o");
  px(g, 12, 23, "o"); // stinger
  return toRows(g);
}

function puff(state) {
  const g = blank();
  ellipse(g, 7.5, 14.5, 5, 5, "b");
  ellipse(g, 16.5, 14.5, 5, 5, "b");
  ellipse(g, 12, 10.5, 6, 5.5, "b");
  ellipse(g, 12, 16, 7, 5, "b");
  ellipse(g, 20.5, 6.5, 1.4, 2, "d"); // a worried sweat drop
  px(g, 20, 4, "d");
  shade(g, { b: ["h", "B"], d: ["d", "D"] });
  if (state === "happy") {
    stamp(g, 8, 12, FACE.happy);
  } else {
    stamp(g, 8, 10, ["k......k", ".k....k."]); // worried brows
    stamp(g, 8, 12, state === "idle" ? ["kw....kw", "kk....kk", "........", "..o..o..", "...oo..."] : FACE.hit);
  }
  outline(g);
  return toRows(g);
}

const PALETTES = {
  "guesswork-gnat": { b: "#8fb8de", h: "#c3dcf1", B: "#6c96bf", g: "#e8f4fb", G: "#b5d3ea" },
  "minimum-mite": { b: "#e7a07a", h: "#f5c6a6", B: "#c47b56", y: "#f4cf55", Y: "#c99a2e" },
  "interest-imp": { b: "#c79ad6", h: "#e2c8ec", B: "#9f72b3", r: "#6a4a8a", R: "#4e3468" },
  "someday-snail": { b: "#a8c98a", h: "#cfe3b8", B: "#86a96a", s: "#c9a774", t: "#dcc293", S: "#9a7a50", p: "#7a5c3b" },
  "hype-hornet": { b: "#e0b25c", h: "#f2d48c", B: "#b88a3a", z: "#3a2e1e", g: "#eef6f8", G: "#c3dbe0" },
  "panic-puff": { b: "#bfe0e4", h: "#e6f4f5", B: "#93c3c9", d: "#7cc4e8", D: "#4f9fca" },
};

const DRAW = { "guesswork-gnat": gnat, "minimum-mite": mite, "interest-imp": imp, "someday-snail": snail, "hype-hornet": hornet, "panic-puff": puff };

export const FOE_STATES = ["idle", "hit", "happy"];

/** { rows, palette } for a Misconception in a state ("idle", "hit" or "happy"). */
export function foeArt(id, state = "idle") {
  const draw = DRAW[id] ?? gnat;
  return { rows: draw(state), palette: { ...COMMON, ...(PALETTES[id] ?? PALETTES["guesswork-gnat"]) } };
}
