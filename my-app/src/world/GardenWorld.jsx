import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { SPROUT_FRONT, SPROUT_PALETTE } from "./sprites";
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

const WELCOME = "Welcome to Sprout's town! Tap a building to visit it, or pick a place from the list below.";

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

  const enter = (b) => go(b.go);
  const describe = (b) => setMessage({ text: `${b.name}: ${b.opens}.`, speaker: null, font: "pixel" });
  const showPlot = () =>
    setMessage({ text: profile.fromSurvey ? garden.description : `With sample numbers: ${garden.description}`, speaker: "Your garden plot", font: "read" });

  const places = [
    // Greenhouses are listed by topic so the names fit on one line.
    ...BUILDINGS.map((b) => (b.kind === "greenhouse" ? { key: b.id, label: b.name.replace(" Greenhouse", ""), sub: "Greenhouse · quiz battle" } : { key: b.id, label: b.name, sub: b.opens })),
    { key: PLOT.id, label: PLOT.name, sub: "What's growing from your numbers" },
  ];
  const onPick = (key) => (key === PLOT.id ? showPlot() : enter(BUILDINGS.find((b) => b.id === key)));

  const top = (
    <div className="gw" ref={screenRef}>
      <div className="gw__stage" style={{ width: MAP_W * scale, height: MAP_H * scale }}>
        <canvas ref={canvasRef} className="gw__ground" style={{ width: MAP_W * scale, height: MAP_H * scale }} aria-hidden />
        <div className="gw__layer" style={{ width: MAP_W, height: MAP_H, transform: `scale(${scale})` }}>
          <button
            type="button"
            className="gw-plot"
            style={{ left: PLOT.x * TILE, top: PLOT.y * TILE, width: PLOT.w * TILE, height: PLOT.h * TILE, zIndex: (PLOT.y + PLOT.h) * 10 }}
            aria-label="Your garden plot. Hear what's growing from your numbers."
            onClick={showPlot}
            onFocus={showPlot}
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
              onClick={() => enter(b)}
              onFocus={() => describe(b)}
              onMouseEnter={() => describe(b)}
            >
              <span className="gw-bld__shadow" aria-hidden />
              <BuildingArt building={b} />
              <span className="gw-tag">{b.name}</span>
            </button>
          ))}
          <div className="gw-sprout" style={{ left: SPAWN.x * TILE, top: SPAWN.y * TILE - 3, zIndex: (SPAWN.y + 1) * 10 }} aria-hidden>
            <PixelArt rows={SPROUT_FRONT} palette={SPROUT_PALETTE} size={TILE} />
          </div>
        </div>
      </div>
    </div>
  );

  const bottomScreen = (
    <div className="gw-panel" ref={bottomRef}>
      <TextBox key={message.text} text={message.text} speaker={message.speaker} font={message.font} instant={instant} />
      <p className="gw-where">
        <EnvironmentOutlined aria-hidden /> Sprout is on the path outside Home.
      </p>
      <h2 className="gw-panel__title">Go to…</h2>
      <ListMenu label="Go to a place in town" items={places} columns={bottom.w >= 520 ? 3 : 2} onSelect={onPick} autoFocus={false} className="gw-goto" />
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
