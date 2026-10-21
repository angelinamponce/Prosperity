// Original 24 x 24 pixel art for the four Greenhouse keepers: friendly gardeners, each with their own
// hat, skin tone, apron and a tool that fits their topic. Painted like everything else in the town.

import { blank, ellipse, line, outline, px, rect, shade, toRows } from "../world/paint";

const darken = (hex, f = 0.78) =>
  `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0")).join("")}`;

const LOOKS = {
  // Fern (Budgeting): a green wide-brim hat with a fern sprig, holding a clipboard: a plan.
  budgeting: { skin: "#f1c9a5", hat: "#5fa97a", apron: "#8fb8a0", shirt: "#f4f1e6", hatKind: "brim", tool: "clipboard" },
  // Bram (Debt): a knit cap, holding pruning shears for cutting debt back.
  debt: { skin: "#8d5a3b", hat: "#6b4f32", apron: "#9a5a38", shirt: "#6b7a3a", hatKind: "cap", tool: "shears" },
  // Maple (Saving): a straw sun hat with a maple leaf, holding a savings jar.
  saving: { skin: "#c68863", hat: "#e9dfc6", apron: "#c9a774", shirt: "#7fbf6a", hatKind: "sun", tool: "jar" },
  // Rowan (Investing): a blue cap, holding a seedling to grow over time.
  investing: { skin: "#e0b48f", hat: "#4f6d8a", apron: "#5d7d9a", shirt: "#e9dfc6", hatKind: "peak", tool: "seedling" },
};

function paintKeeper(look) {
  const g = blank(24, 24);
  // Body: shirt, apron, boots.
  ellipse(g, 12, 17, 5, 4.5, "c");
  rect(g, 9, 14, 6, 7, "a");
  rect(g, 9, 21, 2, 2, "b");
  rect(g, 13, 21, 2, 2, "b");
  // Head and hat.
  ellipse(g, 12, 9, 4, 4, "f");
  if (look.hatKind === "brim") {
    rect(g, 6, 6, 12, 1, "h");
    ellipse(g, 12, 5, 3.6, 2.4, "h");
  } else if (look.hatKind === "cap") {
    ellipse(g, 12, 5.5, 4.4, 2.8, "h");
    px(g, 12, 2, "h");
  } else if (look.hatKind === "sun") {
    rect(g, 5, 6, 14, 1, "h");
    ellipse(g, 12, 5, 3.8, 2.4, "h");
  } else {
    ellipse(g, 12, 5.5, 4.2, 2.6, "h");
    rect(g, 14, 6, 4, 1, "h");
  }
  // The topic's tool, held in front.
  if (look.tool === "clipboard") {
    rect(g, 15, 13, 5, 6, "w");
    rect(g, 16, 12, 3, 1, "b");
    line(g, 16, 15, 18, 15, "q");
    line(g, 16, 17, 18, 17, "q");
  } else if (look.tool === "shears") {
    line(g, 15, 18, 19, 14, "s");
    line(g, 15, 14, 19, 18, "s");
  } else if (look.tool === "jar") {
    rect(g, 15, 15, 4, 4, "u");
    rect(g, 15, 14, 4, 1, "b");
  } else {
    rect(g, 15, 16, 4, 3, "m");
    line(g, 17, 15, 17, 13, "l");
    px(g, 16, 13, "l");
    px(g, 18, 12, "l");
  }
  shade(g, { f: ["f", "F"], h: ["h", "H"], a: ["a", "A"], c: ["c", "C"] });
  outline(g);
  // Face last, so the outline pass doesn't touch it.
  px(g, 10, 9, "k");
  px(g, 14, 9, "k");
  px(g, 11, 11, "r");
  px(g, 12, 11, "r");
  // Hat trims.
  if (look.hatKind === "brim") px(g, 15, 3, "l");
  if (look.hatKind === "sun") {
    px(g, 14, 4, "e");
    px(g, 15, 4, "e");
  }
  return toRows(g);
}

/** { rows, palette } for a topic's keeper. */
export function keeperArt(topic) {
  const look = LOOKS[topic];
  const palette = {
    o: "#2a3a2e",
    k: "#1d2a21",
    f: look.skin, F: darken(look.skin),
    h: look.hat, H: darken(look.hat),
    a: look.apron, A: darken(look.apron),
    c: look.shirt, C: darken(look.shirt),
    b: "#5f4630",
    w: "#fbfbf5",
    s: "#9aa5a8",
    u: "#9fd3e3",
    m: "#c27b52",
    l: "#6fbf5f",
    e: "#e8964a",
    r: "#b5574a",
    q: "#8a8f86",
  };
  return { rows: paintKeeper(look), palette };
}
