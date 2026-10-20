import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppstoreOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { prefersReducedMotion } from "../design";
import { useGame } from "../game/store";
import { deriveGarden } from "../game/garden";
import { gradeBreakdown } from "../dashboard/finance";
import { GLOSSARY } from "../dashboard/glossary";
import { HandheldFrame } from "./HandheldFrame";
import { TextBox } from "./TextBox";
import { ListMenu } from "./ListMenu";
import { PixelArt } from "./PixelArt";
import { BuildingArt } from "./Buildings";
import { BUILDINGS, MAP_H, MAP_W, PLOT, SPAWN, TILE } from "./town";
import { drawGround, pixelScale } from "./ground";
import { SPROUT_FRAMES, SPROUT_PALETTE } from "./sprites";
import { describeSpot, facingPlace } from "./movement";
import { useWalker } from "./useWalker";
import { DPad } from "./DPad";
import "./garden.css";

// Measures an element (falls back to the window where ResizeObserver isn't available).
function useBox() {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box];
}

// The "Go to..." list doesn't change while Sprout walks, so it skips those re-renders.
const GoToList = memo(ListMenu);

const PLACES = [
  // Greenhouses are listed by topic so the names fit on one line.
  ...BUILDINGS.map((b) => (b.kind === "greenhouse" ? { key: b.id, label: b.name.replace(" Greenhouse", ""), sub: "Greenhouse · quiz battle" } : { key: b.id, label: b.name, sub: b.opens })),
  { key: PLOT.id, label: PLOT.name, sub: "What's growing from your numbers" },
];

/** The plot and buildings, as buttons over the ground. Memoized: walking doesn't re-render them. */
const Places = memo(function Places({ onBuilding, onDescribe, onPlot, onPlotFocus }) {
  return (
    <>
      <button
        type="button"
        className="gw-plot"
        style={{ left: PLOT.x * TILE, top: PLOT.y * TILE, width: PLOT.w * TILE, height: PLOT.h * TILE, zIndex: (PLOT.y + PLOT.h) * 10 }}
        aria-label="Your garden plot. Hear what's growing from your numbers."
        onClick={onPlot}
        onFocus={onPlotFocus}
      >
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

// Calls the latest version of a handler through a function whose identity never changes,
// so memoized children don't re-render just because a handler was re-created.
function useStable(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args) => ref.current(...args), []);
}

const WELCOME = "Welcome to Sprout's town! Walk to a building to visit it, or pick a place from the list below.";

const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };

/**
 * Garden mode. The town's ground is painted once onto a canvas; buildings, the plot and Sprout are real
 * elements on top, so they can be focused, read aloud and tapped. Every building opens a part of the plan.
 */
export default function GardenWorld({ profile, metrics, plan, go }) {
  const game = useGame();
  const [screenRef, screen] = useBox();
  const [bottomRef, bottom] = useBox();
  const canvasRef = useRef(null);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const scale = pixelScale(screen.w, screen.h, dpr);
  const instant = Boolean(game?.progress.settings.instantText) || Boolean(prefersReducedMotion());
  const [message, setMessage] = useState({ text: WELCOME, speaker: "Sprout", font: "pixel" });

  // Opening Garden mode is choosing it: the dashboard opens here next time, until Classic View is picked.
  // Recorded once on arrival, so pressing Classic View can't be undone by a later update.
  const chosen = useRef(false);
  useEffect(() => {
    if (!game?.ready || chosen.current) return;
    chosen.current = true;
    if (game.progress.settings.view !== "garden") game.setSetting("view", "garden");
  }, [game]);

  const garden = useMemo(
    () =>
      deriveGarden({
        profile,
        m: metrics,
        plan,
        healthScore: gradeBreakdown(metrics).score,
        learned: game?.ready ? Object.keys(game.progress.terms).length : 0,
        wordTotal: Object.keys(GLOSSARY).length,
      }),
    [profile, metrics, plan, game]
  );

  // Paint the ground once at 1x, then copy it up to the screen's size without smoothing.
  const ground = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = MAP_W;
    c.height = MAP_H;
    const ctx = c.getContext?.("2d");
    if (ctx) drawGround(ctx);
    return ctx ? c : null;
  }, []);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !ground || !screen.w) return;
    cv.width = Math.round(MAP_W * scale * dpr);
    cv.height = Math.round(MAP_H * scale * dpr);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ground, 0, 0, cv.width, cv.height);
  }, [ground, scale, dpr, screen.w]);

  const reduced = Boolean(prefersReducedMotion());
  const enter = (b) => go(b.go);
  const describe = (b) => setMessage({ text: `${b.name}: ${b.opens}.`, speaker: null, font: "pixel" });
  const showPlot = () =>
    setMessage({ text: profile.fromSurvey ? garden.description : `With sample numbers: ${garden.description}`, speaker: "Your garden plot", font: "read" });

  const walker = useWalker({
    start: SPAWN,
    reduced,
    onEnter: enter,
    // Arriving at a door says where it leads.
    onArrive: (p) => {
      const b = BUILDINGS.find((d) => d.door.x === p.x && d.door.y === p.y);
      if (b) setMessage({ text: `${b.name}: ${b.opens}. Walk up or press A to go in.`, speaker: null, font: "pixel" });
    },
  });

  // A (or Enter on the map): go into the building Sprout faces, or look at the plot.
  const interact = () => {
    const place = facingPlace(walker.posRef.current, walker.facing);
    if (!place) return setMessage({ text: "Nothing here to look at. Walk up to a door and press A.", speaker: "Sprout", font: "pixel" });
    if (place.id === PLOT.id) return showPlot();
    return enter(place);
  };

  // Keyboard walking only while the map (or something on it) has focus.
  const [mapFocused, setMapFocused] = useState(false);
  const onMapKeyDown = (e) => {
    const dir = KEYS[e.key];
    if (dir) {
      e.preventDefault();
      if (!e.repeat) walker.walk(dir);
    } else if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
      e.preventDefault();
      interact();
    }
  };
  const onMapKeyUp = (e) => KEYS[e.key] && walker.release(KEYS[e.key]);

  // Tap or click the ground: Sprout walks there along the shortest path.
  const stageRef = useRef(null);
  const onGroundClick = (e) => {
    if (e.detail === 0) return; // keyboard "clicks" are handled by the buttons themselves
    const r = stageRef.current.getBoundingClientRect();
    const tile = { x: Math.floor((e.clientX - r.left) / (TILE * scale)), y: Math.floor((e.clientY - r.top) / (TILE * scale)) };
    if (!walker.goTo(tile)) setMessage({ text: "Sprout can't get there. Try somewhere on the grass or the path.", speaker: "Sprout", font: "pixel" });
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
  const onPlotFocus = useStable(showPlot);
  const onPlotClick = useStable((e) => {
    e.stopPropagation();
    if (e.detail === 0) return showPlot();
    return walker.goTo(PLOT.gate, () => {
      walker.face("up");
      showPlot();
    });
  });
  const stableInteract = useStable(interact);

  const coarse = typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: coarse)").matches);
  const showPad = game?.progress.settings.dpad ?? coarse;

  const onPick = useStable((key) => (key === PLOT.id ? showPlot() : enter(BUILDINGS.find((b) => b.id === key))));

  const { pos, facing, frame, target } = walker;
  const sproutRows = SPROUT_FRAMES[facing === "right" ? "left" : facing][frame];

  const top = (
    <div className="gw" ref={screenRef}>
      <div
        className={`gw__map${mapFocused ? " is-focused" : ""}`}
        tabIndex={0}
        role="group"
        aria-label="Town map"
        aria-describedby="gw-controls"
        onKeyDown={onMapKeyDown}
        onKeyUp={onMapKeyUp}
        onFocus={() => setMapFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setMapFocused(false);
            walker.release();
          }
        }}
      >
        <div
          className="gw__stage"
          ref={stageRef}
          style={{ width: MAP_W * scale, height: MAP_H * scale, left: Math.round((screen.w - MAP_W * scale) / 2), top: Math.round((screen.h - MAP_H * scale) / 2) }}
        >
          <canvas ref={canvasRef} className="gw__ground" style={{ width: MAP_W * scale, height: MAP_H * scale }} aria-hidden />
          <div className="gw__layer" style={{ width: MAP_W, height: MAP_H, transform: `scale(${scale})` }} onClick={onGroundClick}>
            {target && <span className="gw-marker" style={{ left: target.x * TILE, top: target.y * TILE }} aria-hidden />}
            <Places onBuilding={onBuildingClick} onDescribe={onDescribe} onPlot={onPlotClick} onPlotFocus={onPlotFocus} />
            <div
              className={`gw-sprout${reduced ? " is-still" : ""}`}
              style={{ transform: `translate(${pos.x * TILE}px, ${pos.y * TILE - 3}px)`, zIndex: (pos.y + 1) * 10 + 5 }}
              aria-hidden
            >
              <div className={facing === "right" ? "gw-sprout__flip" : undefined}>
                <PixelArt rows={sproutRows} palette={SPROUT_PALETTE} size={TILE} />
              </div>
            </div>
          </div>
        </div>
        {mapFocused && <p className="gw-hint" aria-hidden>Arrow keys or WASD to walk · Enter to go in</p>}
      </div>
    </div>
  );

  const bottomScreen = (
    <div className="gw-panel" ref={bottomRef}>
      <TextBox key={message.text} text={message.text} speaker={message.speaker} font={message.font} instant={instant} />
      <p className="gw-where">
        <EnvironmentOutlined aria-hidden /> Sprout is {describeSpot(pos)}.
      </p>
      <div className="gw-controls">
        <p id="gw-controls" className="gw-controls__text">
          Tap the map to walk. Keyboard: select the map, then arrows or WASD; Enter goes in.
        </p>
        <button type="button" className="gw-controls__toggle" aria-pressed={showPad} onClick={() => game?.setSetting("dpad", !showPad)}>
          {showPad ? "Hide D-pad" : "Show D-pad"}
        </button>
      </div>
      {showPad && <DPad walk={walker.walk} release={walker.release} interact={stableInteract} />}
      <GoToList label="Go to a place in town" items={PLACES} columns={bottom.w >= 520 ? 3 : 2} onSelect={onPick} autoFocus={false} className="gw-goto" />
    </div>
  );

  return (
    <HandheldFrame
      topLabel="Sprout's town"
      bottomLabel="Town guide"
      top={top}
      bottom={bottomScreen}
      toolbar={
        <button
          type="button"
          className="hh-btn hh-btn--light"
          onClick={() => {
            walker.stop();
            game?.setSetting("view", "classic");
            go("");
          }}
        >
          <AppstoreOutlined aria-hidden /> Classic View
        </button>
      }
    />
  );
}
