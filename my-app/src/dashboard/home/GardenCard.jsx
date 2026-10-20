import { useMemo } from "react";
import { Calc } from "../../design";
import { deriveGarden } from "../../game/garden";
import "./home.css";

// A small, static pixel picture of the garden. Every part comes from deriveGarden, so it shows exactly
// what the numbers say. Yellow only appears inside the art (sun, flowers, bees).
const C = {
  sky: "#bfe3f0",
  sky2: "#d9eff2",
  cloud: "#ffffff",
  sun: "#f4cf55",
  sun2: "#f9e08f",
  grass: "#7cbb6e",
  grass2: "#6aa95f",
  grass3: "#9fd07f",
  post: "#5c4a36",
  glass: "#dff3f5",
  glass2: "#b8e1e6",
  roof: "#9fd0d8",
  leaf: "#3f8a4f",
  leaf2: "#5fa97a",
  weed: "#3f6b3a",
  weed2: "#557f45",
  thorn: "#8a5a44",
  pink: "#f08aa0",
  white: "#ffffff",
  ink: "#2a3a2e",
  bird: "#4f6d8a",
};
const SOIL = { resting: ["#d9c9a8", "#cdbb97"], good: ["#b08d5e", "#a07f52"], rich: ["#8b6a45", "#7c5d3b"], lush: ["#6e5135", "#5f4630"] };

const BED = { x: 52, y: 58, cols: 10, rows: 3, cell: 10 };

function Px({ x, y, w = 1, h = 1, c }) {
  return <rect x={x} y={y} width={w} height={h} fill={c} />;
}

function Greenhouse({ stage }) {
  const parts = [<Px key="plot" x={6} y={78} w={40} h={6} c="#c9a774" />];
  if (stage === 0) parts.push(<Px key="s1" x={6} y={72} w={2} h={8} c={C.post} />, <Px key="s2" x={44} y={72} w={2} h={8} c={C.post} />);
  if (stage >= 2) parts.push(<Px key="glass" x={8} y={52} w={36} h={26} c={C.glass} />, <Px key="glass2" x={10} y={54} w={6} h={10} c={C.glass2} />);
  if (stage >= 1) {
    parts.push(
      <Px key="p1" x={6} y={50} w={2} h={28} c={C.post} />,
      <Px key="p2" x={25} y={50} w={2} h={28} c={C.post} />,
      <Px key="p3" x={44} y={50} w={2} h={28} c={C.post} />,
      <Px key="beam" x={6} y={50} w={40} h={2} c={C.post} />
    );
  }
  if (stage >= 3) {
    for (let i = 0; i < 6; i += 1) parts.push(<Px key={`r${i}`} x={8 + i * 3} y={48 - i * 2} w={36 - i * 6} h={2} c={i === 5 ? C.post : C.roof} />);
  }
  if (stage >= 4) {
    [12, 19, 31, 37].forEach((x, i) => parts.push(<Px key={`g${i}`} x={x} y={70} w={3} h={8} c={C.leaf} />, <Px key={`gl${i}`} x={x - 1} y={68} w={5} h={3} c={C.leaf2} />));
    parts.push(<Px key="gf" x={20} y={66} w={2} h={2} c={C.pink} />);
  }
  return <g>{parts}</g>;
}

function Weed({ x, y, thorny }) {
  return (
    <g>
      <Px x={x + 2} y={y + 3} w={1} h={6} c={C.weed} />
      <Px x={x + 5} y={y + 1} w={1} h={8} c={C.weed} />
      <Px x={x + 7} y={y + 4} w={1} h={5} c={C.weed} />
      <Px x={x + 1} y={y + 4} w={2} h={1} c={C.weed2} />
      <Px x={x + 6} y={y + 3} w={2} h={1} c={C.weed2} />
      {thorny && <><Px x={x + 4} y={y + 3} w={1} h={1} c={C.thorn} /><Px x={x + 6} y={y + 6} w={1} h={1} c={C.thorn} /><Px x={x + 3} y={y + 6} w={1} h={1} c={C.thorn} /></>}
    </g>
  );
}

function Flower({ x, y, color }) {
  return (
    <g>
      <Px x={x + 4} y={y + 4} w={1} h={5} c={C.leaf} />
      <Px x={x + 5} y={y + 6} w={2} h={1} c={C.leaf2} />
      <Px x={x + 3} y={y + 1} w={3} h={3} c={color} />
      <Px x={x + 4} y={y + 2} w={1} h={1} c={C.sun} />
    </g>
  );
}

function GardenPicture({ garden }) {
  const { soil, greenhouse, weeds, flowers, visitors } = garden.byId;
  const [dirt, dirt2] = SOIL[soil.state];
  const cells = BED.cols * BED.rows;
  const cell = (i) => ({ x: BED.x + (i % BED.cols) * BED.cell, y: BED.y + Math.floor(i / BED.cols) * BED.cell });

  const weedCells = [];
  weeds.weeds.forEach((w) => {
    for (let k = 0; k < w.patches; k += 1) weedCells.push(w.thorny);
  });
  const weedCount = Math.min(cells, weedCells.length);
  const flowerCount = Math.min(cells - weedCount, flowers.state);

  return (
    <svg className="hm-garden__pic" viewBox="0 0 160 96" shapeRendering="crispEdges" aria-hidden>
      <Px x={0} y={0} w={160} h={36} c={C.sky} />
      <Px x={0} y={26} w={160} h={10} c={C.sky2} />
      <Px x={136} y={6} w={8} h={8} c={C.sun} />
      <Px x={134} y={8} w={12} h={4} c={C.sun} />
      <Px x={138} y={4} w={4} h={12} c={C.sun} />
      <Px x={137} y={7} w={3} h={2} c={C.sun2} />
      <Px x={20} y={10} w={14} h={3} c={C.cloud} />
      <Px x={23} y={8} w={7} h={2} c={C.cloud} />
      <Px x={84} y={16} w={12} h={3} c={C.cloud} />
      <Px x={0} y={36} w={160} h={60} c={C.grass} />
      <Px x={0} y={36} w={160} h={2} c={C.grass3} />
      {Array.from({ length: 18 }, (_, i) => (
        <Px key={i} x={(i * 37) % 158} y={40 + ((i * 13) % 52)} w={2} h={1} c={C.grass2} />
      ))}

      <Greenhouse stage={greenhouse.state} />

      <Px x={BED.x - 2} y={BED.y - 2} w={BED.cols * BED.cell + 4} h={BED.rows * BED.cell + 4} c={dirt2} />
      <Px x={BED.x} y={BED.y} w={BED.cols * BED.cell} h={BED.rows * BED.cell} c={dirt} />
      {soil.state === "lush" &&
        Array.from({ length: 8 }, (_, i) => <Px key={`t${i}`} x={BED.x + 6 + i * 12} y={BED.y + BED.rows * BED.cell - 2} w={3} h={1} c={C.grass3} />)}
      {weedCells.slice(0, weedCount).map((thorny, i) => (
        <Weed key={`w${i}`} {...cell(i)} thorny={thorny} />
      ))}
      {Array.from({ length: flowerCount }, (_, i) => (
        <Flower key={`f${i}`} {...cell(weedCount + i)} color={i % 2 ? C.sun : C.pink} />
      ))}

      {visitors.visitors.includes("butterflies") && (
        <g>
          <Px x={96} y={44} w={2} h={2} c={C.pink} /><Px x={99} y={44} w={2} h={2} c={C.pink} /><Px x={98} y={45} w={1} h={2} c={C.ink} />
          <Px x={70} y={48} w={2} h={2} c={C.white} /><Px x={73} y={48} w={2} h={2} c={C.white} /><Px x={72} y={49} w={1} h={2} c={C.ink} />
        </g>
      )}
      {visitors.visitors.includes("bees") && (
        <g>
          <Px x={124} y={47} w={4} h={3} c={C.sun} /><Px x={125} y={47} w={1} h={3} c={C.ink} /><Px x={125} y={45} w={2} h={2} c={C.white} />
        </g>
      )}
      {visitors.visitors.includes("a bird") && (
        <g>
          <Px x={58} y={18} w={6} h={3} c={C.bird} /><Px x={56} y={16} w={3} h={2} c={C.bird} /><Px x={63} y={16} w={3} h={2} c={C.bird} /><Px x={64} y={19} w={2} h={1} c={C.sun} />
        </g>
      )}
    </svg>
  );
}

/**
 * The garden preview: a picture from the player's real numbers and learning, a plain description, and
 * every element with its number one tap away, and a way into Garden mode.
 */
export default function GardenCard({ profile, metrics, plan, healthScore, learned, wordTotal, onVisit, className = "", style }) {
  const garden = useMemo(
    () => deriveGarden({ profile, m: metrics, plan, healthScore, learned, wordTotal }),
    [profile, metrics, plan, healthScore, learned, wordTotal]
  );
  return (
    <section className={`ps-card hm-garden ${className}`} style={style} aria-labelledby="hm-garden-title">
      <div className="hm-card-head">
        <h2 id="hm-garden-title" className="ps-h3">Your garden</h2>
        <span className="hm-chip hm-chip--plain">{profile.fromSurvey ? "Grows from your numbers" : "Sample numbers"}</span>
      </div>
      {onVisit && (
        <button type="button" className="ps-btn ps-btn--secondary ps-btn--sm hm-garden__visit" onClick={onVisit}>
          Visit your garden <span aria-hidden>→</span>
        </button>
      )}
      <figure className="hm-garden__figure">
        <GardenPicture garden={garden} />
        <figcaption className="ps-small">{garden.description}</figcaption>
      </figure>
      <dl className="hm-garden__list">
        {garden.elements.map((e) => (
          <div key={e.id}>
            <dt>{e.name}</dt>
            <dd>
              {e.label} · <Calc value={e.value} title={e.title} calc={e.calc} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
