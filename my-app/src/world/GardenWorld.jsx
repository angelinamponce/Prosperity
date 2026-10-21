import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppstoreOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { prefersReducedMotion } from "../design";
import { useGame } from "../game/store";
import { deriveGarden } from "../game/garden";
import { gradeBreakdown } from "../dashboard/finance";
import { GLOSSARY } from "../dashboard/glossary";
import { layoutGarden } from "./gardenMap";
import { PlotMiniature } from "./PlotMiniature";
import { HandheldFrame } from "./HandheldFrame";
import { TextBox } from "./TextBox";
import { ListMenu } from "./ListMenu";
import { BuildingArt } from "./Buildings";
import { BUILDINGS, PLOT, SPAWN, TILE, TOWN } from "./town";
import { facingPlace } from "./movement";
import { useWalker } from "./useWalker";
import { WalkControls } from "./DPad";
import { WorldMap, useBox, useStable } from "./WorldMap";
import "./garden.css";

// The garden scene loads only when someone walks into the plot.
const GardenScene = lazy(() => import("./GardenScene"));

// The "Go to..." list doesn't change while Sprout walks, so it skips those re-renders.
const GoToList = memo(ListMenu);

const PLACES = [
  // Greenhouses are listed by topic so the names fit on one line.
  ...BUILDINGS.map((b) => (b.kind === "greenhouse" ? { key: b.id, label: b.name.replace(" Greenhouse", ""), sub: "Greenhouse · quiz battle" } : { key: b.id, label: b.name, sub: b.opens })),
  { key: PLOT.id, label: PLOT.name, sub: "See what's growing from your numbers" },
];

/** The plot and buildings, as buttons over the ground. Memoized: walking doesn't re-render them. */
const Places = memo(function Places({ garden, layout, onBuilding, onDescribe, onPlot, onPlotFocus }) {
  return (
    <>
      <button
        type="button"
        className="gw-plot"
        style={{ left: PLOT.x * TILE, top: PLOT.y * TILE, width: PLOT.w * TILE, height: PLOT.h * TILE, zIndex: (PLOT.y + PLOT.h) * 10 }}
        aria-label={`Your garden plot. ${garden.description} Go in to see the numbers behind it.`}
        onClick={onPlot}
        onFocus={onPlotFocus}
      >
        {/* A miniature of the garden on the plot's soil, drawn from the same layout as the Garden scene. */}
        <span className="gw-mini-wrap" style={{ left: TILE, top: TILE }}>
          <PlotMiniature layout={layout} />
        </span>
        <span className="gw-tag">Your garden</span>
      </button>
      {BUILDINGS.map((b) => (
        <button
          key={b.id}
          type="button"
          className="gw-bld"
          style={{ left: b.x * TILE, top: (b.y - 1) * TILE, width: b.w * TILE, height: (b.h + 1) * TILE, zIndex: (b.y + b.h) * 10 }}
          aria-label={`${b.name}. Opens ${b.opens}.`}
          onClick={(e) => onBuilding(b, e)}
          onFocus={() => onDescribe(b)}
          onMouseEnter={() => onDescribe(b)}
        >
          <span className="gw-bld__shadow" aria-hidden />
          <BuildingArt building={b} />
          <span className="gw-tag">{b.name}</span>
        </button>
      ))}
    </>
  );
});

const WELCOME = "Welcome to Sprout's town! Walk to a building to visit it, or pick a place from the list below.";
const PLOT_LINE = "Your garden plot: see what's growing from your numbers. Walk up through the gate to go in.";

/** The town: buildings open parts of the plan; the plot's gate leads into the Garden scene. */
function TownScene({ go, fromPlot, profile, metrics, plan }) {
  const game = useGame();
  const learned = game?.ready ? Object.keys(game.progress.terms).length : 0;
  const garden = useMemo(
    () => deriveGarden({ profile, m: metrics, plan, healthScore: gradeBreakdown(metrics).score, learned, wordTotal: Object.keys(GLOSSARY).length }),
    [profile, metrics, plan, learned]
  );
  const layout = useMemo(() => layoutGarden(garden), [garden]);
  const [bottomRef, bottom] = useBox();
  const instant = Boolean(game?.progress.settings.instantText) || Boolean(prefersReducedMotion());
  const reduced = Boolean(prefersReducedMotion());
  const [message, setMessage] = useState(
    fromPlot ? { text: "Back in town. Your garden is right behind you.", speaker: "Sprout", font: "pixel" } : { text: WELCOME, speaker: "Sprout", font: "pixel" }
  );

  const enterGarden = () => go("garden?scene=plot");
  const enter = (place) => (place.id === PLOT.id ? enterGarden() : go(place.go));
  const describe = (b) => setMessage({ text: `${b.name}: ${b.opens}.`, speaker: null, font: "pixel" });

  const walker = useWalker({
    world: TOWN,
    // Coming back from the garden, Sprout steps out through the gate.
    start: fromPlot ? { x: PLOT.gate.x, y: PLOT.gate.y + 1 } : SPAWN,
    reduced,
    onEnter: enter,
    // Arriving at a door says where it leads.
    onArrive: (p) => {
      if (p.x === PLOT.gate.x && p.y === PLOT.gate.y) return setMessage({ text: PLOT_LINE, speaker: null, font: "pixel" });
      const b = BUILDINGS.find((d) => d.door.x === p.x && d.door.y === p.y);
      if (b) setMessage({ text: `${b.name}: ${b.opens}. Walk up or press A to go in.`, speaker: null, font: "pixel" });
      return undefined;
    },
  });

  // A (or Enter on the map): go into the building or plot Sprout faces.
  const interact = () => {
    const place = facingPlace(TOWN, walker.posRef.current, walker.facing);
    if (!place) return setMessage({ text: "Nothing here to look at. Walk up to a door and press A.", speaker: "Sprout", font: "pixel" });
    return enter(place);
  };

  // Tapping a building walks to its door and goes in; from the keyboard it opens right away.
  const onBuildingClick = useStable((b, e) => {
    e.stopPropagation();
    if (e.detail === 0) return enter(b);
    return walker.goTo(b.door, () => {
      walker.face("up");
      enter(b);
    });
  });
  const onDescribe = useStable(describe);
  const onPlotFocus = useStable(() => setMessage({ text: PLOT_LINE, speaker: null, font: "pixel" }));
  const onPlotClick = useStable((e) => {
    e.stopPropagation();
    if (e.detail === 0) return enterGarden();
    return walker.goTo(PLOT.gate, () => {
      walker.face("up");
      enterGarden();
    });
  });
  const stableInteract = useStable(interact);
  const onPick = useStable((key) => enter(key === PLOT.id ? PLOT : BUILDINGS.find((b) => b.id === key)));

  const top = (
    <WorldMap
      world={TOWN}
      walker={walker}
      reduced={reduced}
      label="Town map"
      onInteract={interact}
      onUnreachable={() => setMessage({ text: "Sprout can't get there. Try somewhere on the grass or the path.", speaker: "Sprout", font: "pixel" })}
    >
      <Places garden={garden} layout={layout} onBuilding={onBuildingClick} onDescribe={onDescribe} onPlot={onPlotClick} onPlotFocus={onPlotFocus} />
    </WorldMap>
  );

  const bottomScreen = (
    <div className="gw-panel" ref={bottomRef}>
      <TextBox key={message.text} text={message.text} speaker={message.speaker} font={message.font} instant={instant} />
      <p className="gw-where">
        <EnvironmentOutlined aria-hidden /> Sprout is {TOWN.describe(walker.pos)}.
      </p>
      <WalkControls walker={walker} interact={stableInteract} />
      <GoToList label="Go to a place in town" items={PLACES} columns={bottom.w >= 520 ? 3 : 2} onSelect={onPick} autoFocus={false} className="gw-goto" />
    </div>
  );

  return (
    <HandheldFrame
      topLabel="Sprout's town"
      bottomLabel="Town guide"
      top={top}
      bottom={bottomScreen}
      toolbar={<ClassicViewButton go={go} onLeave={walker.stop} />}
    />
  );
}

/** Always on the hinge: back to the Classic dashboard, remembered as the chosen view. */
export function ClassicViewButton({ go, onLeave }) {
  const game = useGame();
  return (
    <button
      type="button"
      className="hh-btn hh-btn--light"
      onClick={() => {
        onLeave?.();
        game?.setSetting("view", "classic");
        go("");
      }}
    >
      <AppstoreOutlined aria-hidden /> Classic View
    </button>
  );
}

/**
 * Garden mode: the town, and (with ?scene=plot) the Garden scene. Buildings, the plot and Sprout are real
 * elements over a canvas-painted ground, so they can be focused, read aloud and tapped.
 */
export default function GardenWorld(props) {
  const { query } = props;
  const game = useGame();

  // Opening Garden mode is choosing it: the dashboard opens here next time, until Classic View is picked.
  // Recorded once on arrival, so pressing Classic View can't be undone by a later update.
  const chosen = useRef(false);
  useEffect(() => {
    if (!game?.ready || chosen.current) return;
    chosen.current = true;
    if (game.progress.settings.view !== "garden") game.setSetting("view", "garden");
  }, [game]);

  if (query?.get("scene") === "plot") {
    return (
      <Suspense fallback={<div className="px-root gw-loading" role="status">Opening your garden…</div>}>
        <GardenScene {...props} />
      </Suspense>
    );
  }
  return <TownScene go={props.go} fromPlot={query?.get("from") === "plot"} profile={props.profile} metrics={props.metrics} plan={props.plan} />;
}
