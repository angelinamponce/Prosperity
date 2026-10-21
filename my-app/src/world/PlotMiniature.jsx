import { memo } from "react";
import { BEDS, BORDER } from "./gardenMap";

// The town plot's tiny picture of your garden: the same layout as the Garden scene (weeds, crops,
// flowers), shrunk to 32 x 32 art pixels so it fits the plot's 2 x 2 soil tiles. Saved plan only;
// what-ifs stay inside the garden.

const C = {
  soil: "#9a7650",
  path: "#c9a774",
  crop: { resting: "#b5dc95", good: "#8fd07a", rich: "#79c766", lush: "#6fbf5f" },
  fruit: "#e06a4e",
  weed: "#24391f",
  bramble: "#5e6b34",
  thorn: "#8a5a44",
  seedling: "#5fa97a",
  bloom: { pink: "#f08aa0", sun: "#f4cf55", white: "#fbfbf5", lilac: "#b89ad6" },
};

const R = ({ x, y, w = 1, h = 1, c }) => <rect x={x} y={y} width={w} height={h} fill={c} />;

// Bed tile (x, y) -> its 3 x 3 cell in the miniature: 10 cells across, beds stacked with a 2px path between.
const cell = (t) => {
  const bed = BEDS.findIndex((b) => t.y >= b.y && t.y < b.y + b.h);
  return { x: 1 + (t.x - BEDS[bed].x) * 3, y: 1 + bed * 8 + (t.y - BEDS[bed].y) * 3 };
};

export const PlotMiniature = memo(function PlotMiniature({ layout }) {
  return (
    <svg className="gw-mini" viewBox="0 0 32 32" width={32} height={32} shapeRendering="crispEdges" aria-hidden>
      <R x={0} y={0} w={32} h={32} c={C.soil} />
      <R x={0} y={7} w={32} h={2} c={C.path} />
      <R x={0} y={15} w={32} h={2} c={C.path} />
      <R x={0} y={23} w={32} h={2} c={C.path} />
      {layout.crops.map((t) => {
        const { x, y } = cell(t);
        return (
          <g key={`c${t.x}-${t.y}`}>
            <R x={x} y={y} w={2} h={2} c={C.crop[t.tier]} />
            {t.tier === "lush" && (t.x + t.y) % 2 === 0 && <R x={x + 1} y={y} c={C.fruit} />}
          </g>
        );
      })}
      {layout.weeds.map((t) => {
        const { x, y } = cell(t);
        return (
          <g key={`w${t.x}-${t.y}`}>
            <R x={x} y={y} w={2} h={2} c={t.thorny ? C.bramble : C.weed} />
            {t.thorny && <R x={x + 1} y={y} c={C.thorn} />}
          </g>
        );
      })}
      {layout.flowers.map((f) => {
        const i = f.x - BORDER.x;
        return <R key={`f${f.x}-${f.y}`} x={2 + Math.round(i * 2.5)} y={26 + (f.y - BORDER.y) * 3} w={1} h={2} c={f.bloom ? C.bloom[f.color] : C.seedling} />;
      })}
    </svg>
  );
});
