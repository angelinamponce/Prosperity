import { TILE } from "./town";

// Original pixel-art buildings, drawn from rectangles. Each stands one tile taller than its footprint
// (the roof rises above it) for a three-quarters view. Coordinates are art pixels.

const R = ({ x, y, w, h, c }) => <rect x={x} y={y} width={w} height={h} fill={c} />;

const INK = "#2a3a2e";
const WOOD = "#8a6a48";
const WOOD_DARK = "#6b5238";
const GLASS = "#bfe3f0";
const GLASS_LIGHT = "#e3f4f8";

function Window({ x, y, w = 8, h = 8 }) {
  return (
    <g>
      <R x={x - 1} y={y - 1} w={w + 2} h={h + 2} c={WOOD_DARK} />
      <R x={x} y={y} w={w} h={h} c={GLASS} />
      <R x={x} y={y} w={3} h={3} c={GLASS_LIGHT} />
      <R x={x + w / 2 - 0.5} y={y} w={1} h={h} c={WOOD_DARK} />
    </g>
  );
}

function Door({ x, y, h, c = WOOD }) {
  return (
    <g>
      <R x={x} y={y} w={10} h={h} c={INK} />
      <R x={x + 1} y={y + 1} w={8} h={h - 1} c={c} />
      <R x={x + 6} y={y + h / 2} w={1} h={2} c="#f4cf55" />
    </g>
  );
}

// A gabled roof across the top `h` pixels, overhanging the walls by 2px.
function Roof({ w, h, c, dark, light }) {
  const rows = [];
  for (let i = 0; i < h; i += 1) {
    const inset = Math.max(0, Math.round(((h - 1 - i) / h) * 6) - 2);
    rows.push(<R key={i} x={inset} y={i} w={w - inset * 2} h={1} c={i % 4 === 3 ? dark : c} />);
  }
  return (
    <g>
      {rows}
      <R x={6} y={0} w={w - 12} h={1} c={light} />
      <R x={0} y={h - 1} w={w} h={2} c={dark} />
    </g>
  );
}

function Home({ w, h, doorX }) {
  const roof = 26;
  return (
    <g>
      <R x={w - 16} y={2} w={6} h={12} c="#a0503f" />
      <R x={w - 17} y={1} w={8} h={2} c="#7d3e31" />
      <Roof w={w} h={roof} c="#4f8f5f" dark="#3a6e48" light="#79b585" />
      <R x={2} y={roof} w={w - 4} h={h - roof} c="#f3ead6" />
      <R x={2} y={h - 3} w={w - 4} h={3} c="#d9cbab" />
      <R x={2} y={roof} w={2} h={h - roof} c={WOOD} />
      <R x={w - 4} y={roof} w={2} h={h - roof} c={WOOD} />
      <Window x={8} y={roof + 8} />
      <Window x={w - 18} y={roof + 8} />
      <Door x={doorX + 3} y={h - 22} h={22} />
    </g>
  );
}

function Library({ w, h, doorX }) {
  const roof = 22;
  return (
    <g>
      <Roof w={w} h={roof} c="#4f8fa0" dark="#3b6f7d" light="#7fb6c4" />
      <R x={2} y={roof} w={w - 4} h={h - roof} c="#e7e1d3" />
      <R x={2} y={roof} w={w - 4} h={3} c="#cfc6b2" />
      {[4, 18, w - 26, w - 12].map((x) => <R key={x} x={x} y={roof + 3} w={4} h={h - roof - 3} c="#d6cdb9" />)}
      <Window x={10} y={roof + 10} w={6} h={10} />
      <Window x={w - 18} y={roof + 10} w={6} h={10} />
      <Door x={doorX + 3} y={h - 22} h={22} c="#4f6d8a" />
      {/* A little open book over the door */}
      <R x={doorX + 2} y={roof + 4} w={12} h={6} c="#ffffff" />
      <R x={doorX + 7} y={roof + 4} w={2} h={6} c="#4f8fa0" />
    </g>
  );
}

function Toolshed({ w, h, doorX }) {
  const roof = 18;
  return (
    <g>
      <Roof w={w} h={roof} c="#7a5c3b" dark="#5e4630" light="#9a7a54" />
      {Array.from({ length: Math.floor((w - 4) / 4) }, (_, i) => (
        <R key={i} x={2 + i * 4} y={roof} w={4} h={h - roof} c={i % 2 ? "#a07f52" : "#b08d5e"} />
      ))}
      <Door x={doorX + 3} y={h - 20} h={20} c="#6b5238" />
      {/* A rake hanging by the door */}
      <R x={w - 9} y={roof + 4} w={1} h={16} c={WOOD_DARK} />
      <R x={w - 12} y={roof + 4} w={7} h={2} c="#9fa8a3" />
    </g>
  );
}

const TOPIC_SIGN = { budgeting: "#4f7cc4", debt: "#d1683f", saving: "#3d8a5a", investing: "#8e4fa0" };

function Greenhouse({ w, h, doorX, topic }) {
  const top = 14;
  return (
    <g>
      {/* Arched glass roof */}
      {Array.from({ length: top }, (_, i) => {
        // A quarter-circle curve: narrow at the top, full width where the roof meets the walls.
        const t = (top - i) / top;
        const inset = Math.round(12 * (1 - Math.sqrt(1 - t * t)));
        return <R key={i} x={inset} y={i} w={w - inset * 2} h={1} c={i % 5 === 0 ? "#2f6b48" : GLASS_LIGHT} />;
      })}
      <R x={0} y={top} w={w} h={h - top} c="#d9f0f3" />
      {Array.from({ length: Math.floor(w / 8) + 1 }, (_, i) => <R key={i} x={Math.min(w - 2, i * 8)} y={4} w={2} h={h - 4} c="#2f6b48" />)}
      <R x={0} y={top} w={w} h={2} c="#2f6b48" />
      <R x={0} y={h - 2} w={w} h={2} c="#2f6b48" />
      {/* Plants inside */}
      {[5, 13, 29, 37].filter((x) => x < w - 4).map((x) => (
        <g key={x}>
          <R x={x} y={h - 10} w={3} h={7} c="#3f8a4f" />
          <R x={x - 1} y={h - 12} w={5} h={3} c="#5fa97a" />
        </g>
      ))}
      <Door x={doorX + 3} y={h - 18} h={16} c="#cde9df" />
      {/* Topic sign */}
      <R x={w / 2 - 6} y={top + 3} w={12} h={7} c={INK} />
      <R x={w / 2 - 5} y={top + 4} w={10} h={5} c={TOPIC_SIGN[topic]} />
    </g>
  );
}

function Weather({ w, h, doorX }) {
  return (
    <g>
      {/* Wind vane */}
      <R x={w / 2 - 0.5} y={0} w={1} h={10} c={INK} />
      <R x={w / 2 - 6} y={3} w={12} h={2} c={INK} />
      <R x={w / 2 + 4} y={2} w={3} h={4} c="#d1683f" />
      <Roof w={w} h={16} c="#5b7fa8" dark="#46668a" light="#86a6c8" />
      <R x={3} y={16} w={w - 6} h={h - 16} c="#eef3f2" />
      <R x={3} y={16} w={w - 6} h={2} c="#cdd8d6" />
      <Window x={9} y={22} w={8} h={8} />
      <Window x={9} y={36} w={8} h={8} />
      <Door x={doorX + 3} y={h - 18} h={18} c="#5b7fa8" />
    </g>
  );
}

const ART = { home: Home, library: Library, toolshed: Toolshed, greenhouse: Greenhouse, weather: Weather };

/** The building's picture, sized to its footprint plus one tile of roof above. */
export function BuildingArt({ building }) {
  const w = building.w * TILE;
  const h = (building.h + 1) * TILE;
  const Art = ART[building.kind];
  const doorX = (building.door.x - building.x) * TILE;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} shapeRendering="crispEdges" aria-hidden className="gw-bld__art">
      <Art w={w} h={h} doorX={doorX} topic={building.topic} />
    </svg>
  );
}

export const TOPIC_SIGN_COLORS = TOPIC_SIGN;
