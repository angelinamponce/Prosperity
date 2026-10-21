import { memo } from "react";
import { PixelArt } from "./PixelArt";
import { blank, ellipse, line, outline, px, rect, shade, toRows } from "./paint";

// Original pixel art for the Garden scene, painted from simple shapes with the same shading and outline
// as Sprout, the town and the Misconceptions. Yellow appears only inside the art (flowers, bees, sun).

const P = {
  o: "#2a3a2e",
  w: "#3f6b3a", W: "#557f45", // weed greens
  n: "#5e6b34", N: "#7a8a44", x: "#8a5a44", // bramble stem and thorns
  c: "#6fbf5f", C: "#4f9d4a", h: "#a8dc8f", // crop leaves
  r: "#e06a4e", R: "#b84a32", // tomato
  m: "#8b6a45", // soil mound
  s: "#5fa97a", S: "#3d8a5a", // stems and seedling leaves
  y: "#f4cf55", // flower centers, bees (art only)
  p: "#f08aa0", e: "#fbfbf5", l: "#b89ad6", // petals (pink, white, lilac; sun-yellow petals reuse y)
  b: "#4f6d8a", // bird
  k: "#1d2a21",
  g: "#eef6f8",
  t: "#a07f52", T: "#7a5c3b", // wood
  a: "#8fb3c4", A: "#6c93a6", // watering can
  u: "#cfe6ef", // bird bath water
  v: "#d9d3c4", V: "#b5ad9a", // stone
};

const sprite = (draw) => {
  const g = blank(16, 16);
  draw(g);
  return toRows(g);
};

const WEED = sprite((g) => {
  line(g, 5, 14, 3, 6, "w");
  line(g, 8, 14, 8, 4, "w");
  line(g, 11, 14, 13, 6, "w");
  line(g, 8, 10, 5, 8, "W");
  line(g, 8, 9, 11, 7, "W");
  outline(g);
});

const BRAMBLE = sprite((g) => {
  line(g, 3, 14, 5, 4, "n");
  line(g, 8, 14, 9, 3, "n");
  line(g, 13, 14, 11, 5, "n");
  line(g, 5, 8, 9, 6, "N");
  outline(g);
  [[4, 9], [6, 5], [9, 9], [10, 4], [12, 8], [3, 12]].forEach(([x, y]) => px(g, x, y, "x"));
});

const CROPS = {
  resting: sprite((g) => {
    ellipse(g, 8, 14, 3.5, 1.4, "m");
    line(g, 8, 13, 8, 10, "s");
    ellipse(g, 6, 9.5, 2, 1.3, "c");
    ellipse(g, 10, 9.5, 2, 1.3, "c");
    shade(g, { c: ["h", "C"] });
    outline(g);
  }),
  good: sprite((g) => {
    ellipse(g, 8, 11, 4, 3, "c");
    ellipse(g, 5.5, 9, 2, 2, "c");
    ellipse(g, 10.5, 9, 2, 2, "c");
    shade(g, { c: ["h", "C"] });
    outline(g);
  }),
  rich: sprite((g) => {
    ellipse(g, 8, 10, 5.5, 4.5, "c");
    shade(g, { c: ["h", "C"] });
    line(g, 8, 7, 8, 13, "C");
    line(g, 5, 9, 8, 11, "C");
    line(g, 11, 9, 8, 11, "C");
    outline(g);
  }),
  lush: sprite((g) => {
    ellipse(g, 8, 10, 6, 4.8, "c");
    shade(g, { c: ["h", "C"] });
    line(g, 8, 7, 8, 13, "C");
    ellipse(g, 11, 6, 2, 2, "r");
    ellipse(g, 5, 7, 1.6, 1.6, "r");
    shade(g, { r: ["r", "R"] });
    outline(g);
  }),
};

const SEEDLING = sprite((g) => {
  ellipse(g, 8, 14, 3.2, 1.3, "m");
  line(g, 8, 13, 8, 10, "s");
  ellipse(g, 6.5, 9.5, 1.6, 1.1, "s");
  ellipse(g, 9.5, 9, 1.6, 1.1, "S");
  outline(g);
});

const flower = (color) =>
  sprite((g) => {
    line(g, 8, 14, 8, 8, "s");
    ellipse(g, 10, 11, 1.6, 1, "S");
    ellipse(g, 8, 6, 3, 3, color);
    px(g, 8, 6, color === "y" ? "T" : "y");
    px(g, 7, 6, color === "y" ? "T" : "y");
    outline(g);
  });
const FLOWERS = { pink: flower("p"), sun: flower("y"), white: flower("e"), lilac: flower("l") };

const BUTTERFLY = sprite((g) => {
  ellipse(g, 5.5, 7, 3, 2.6, "p");
  ellipse(g, 10.5, 7, 3, 2.6, "p");
  ellipse(g, 6, 10.5, 2, 1.8, "e");
  ellipse(g, 10, 10.5, 2, 1.8, "e");
  outline(g);
  line(g, 8, 5, 8, 12, "k");
});

// Wings folded up: the second flutter frame.
const BUTTERFLY_UP = sprite((g) => {
  ellipse(g, 6.5, 5.5, 2, 3.4, "p");
  ellipse(g, 9.5, 5.5, 2, 3.4, "p");
  ellipse(g, 7, 10, 1.4, 1.6, "e");
  ellipse(g, 9, 10, 1.4, 1.6, "e");
  outline(g);
  line(g, 8, 5, 8, 12, "k");
});

// The little flag on a patch your plan would clear within the year: a marker, never a removal.
const FLAG = sprite((g) => {
  line(g, 13, 1, 13, 9, "T");
  rect(g, 8, 1, 5, 4, "e");
  px(g, 8, 4, "o");
  outline(g);
});

const BEE = sprite((g) => {
  ellipse(g, 6, 5.5, 2.4, 2, "g");
  ellipse(g, 10, 5.5, 2.4, 2, "g");
  ellipse(g, 8, 9.5, 4, 3, "y");
  line(g, 7, 7, 7, 12, "k");
  line(g, 9, 7, 9, 12, "k");
  outline(g);
});

const BIRD = sprite((g) => {
  ellipse(g, 8, 10, 4.5, 3.2, "b");
  ellipse(g, 11.5, 6.5, 2.4, 2.4, "b");
  outline(g);
  px(g, 14, 7, "y");
  px(g, 12, 6, "k");
});

const BIRDBATH = sprite((g) => {
  rect(g, 7, 9, 2, 5, "v");
  ellipse(g, 8, 8, 5, 1.8, "v");
  ellipse(g, 8, 7.6, 3.8, 1, "u");
  rect(g, 5, 14, 6, 1, "V");
  outline(g);
});

const SIGNPOST = sprite((g) => {
  rect(g, 7, 8, 2, 7, "t");
  rect(g, 2, 2, 12, 7, "t");
  rect(g, 2, 8, 12, 1, "T");
  ellipse(g, 8, 5, 2.2, 2.2, "y");
  outline(g);
});

const CAN = sprite((g) => {
  rect(g, 4, 8, 7, 6, "a");
  line(g, 11, 10, 14, 7, "A");
  rect(g, 6, 5, 3, 1, "A");
  shade(g, { a: ["a", "A"] });
  outline(g);
});

const BENCH = sprite((g) => {
  rect(g, 1, 7, 14, 2, "t");
  rect(g, 1, 10, 14, 2, "t");
  rect(g, 2, 12, 2, 3, "T");
  rect(g, 12, 12, 2, 3, "T");
  outline(g);
});

export const ART = { WEED, BRAMBLE, CROPS, SEEDLING, FLOWERS, BUTTERFLY, BUTTERFLY_UP, FLAG, BEE, BIRD, BIRDBATH, SIGNPOST, CAN, BENCH };

/** One 16px garden sprite. Memoized: these never change while Sprout walks. */
export const Tile = memo(function Tile({ rows, size = 16 }) {
  return <PixelArt rows={rows} palette={P} size={size} />;
});

// ---------- The greenhouse, in five stages (SVG, like the town's buildings) ----------

const Rc = ({ x, y, w, h, c }) => <rect x={x} y={y} width={w} height={h} fill={c} />;
const FRAME = "#5c4a36";
const GLASS = "#d9f0f3";
const GLASS2 = "#b8e1e6";

/**
 * The emergency-fund greenhouse. Even stage 0 ("just a plot") looks tended: a staked, string-lined
 * foundation with seed trays waiting. Then the frame goes up, the walls, the roof, and finally plants inside.
 */
export const GreenhouseArt = memo(function GreenhouseArt({ stage }) {
  const w = 64;
  const h = 80;
  const base = h - 8;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} shapeRendering="crispEdges" aria-hidden className="gw-bld__art">
      <Rc x={2} y={base} w={60} h={6} c="#c9a774" />
      {stage === 0 && (
        <g>
          {[2, 30, 58].map((x) => <Rc key={x} x={x} y={base - 10} w={3} h={12} c={FRAME} />)}
          <Rc x={2} y={base - 8} w={59} h={1} c="#fbfbf5" />
          {[8, 24, 40].map((x) => (
            <g key={x}>
              <Rc x={x} y={base - 4} w={12} h={4} c="#8b6a45" />
              {[2, 6, 10].map((d) => <Rc key={d} x={x + d - 1} y={base - 7} w={2} h={3} c="#5fa97a" />)}
            </g>
          ))}
        </g>
      )}
      {stage >= 2 && <Rc x={4} y={22} w={56} h={base - 22} c={GLASS} />}
      {stage >= 2 && <Rc x={8} y={26} w={10} h={18} c={GLASS2} />}
      {stage >= 1 && (
        <g>
          {[2, 21, 40, 59].map((x) => <Rc key={x} x={x} y={20} w={3} h={base - 20} c={FRAME} />)}
          <Rc x={2} y={20} w={60} h={3} c={FRAME} />
        </g>
      )}
      {stage >= 3 &&
        Array.from({ length: 8 }, (_, i) => (
          <Rc key={i} x={4 + i * 3} y={20 - i * 2} w={56 - i * 6} h={2} c={i === 7 ? FRAME : i % 2 ? GLASS2 : GLASS} />
        ))}
      {stage >= 4 && (
        <g>
          {[10, 22, 36, 48].map((x, i) => (
            <g key={x}>
              <Rc x={x} y={base - 14} w={4} h={14} c="#3f8a4f" />
              <Rc x={x - 2} y={base - 18} w={8} h={5} c="#5fa97a" />
              {i % 2 === 0 && <Rc x={x + 1} y={base - 20} w={2} h={2} c="#f08aa0" />}
            </g>
          ))}
          <Rc x={26} y={base - 18} w={12} h={18} c="#cde9df" />
        </g>
      )}
    </svg>
  );
});
