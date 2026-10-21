import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PixelArt } from "./PixelArt";
import { TILE } from "./town";
import { drawGround, pixelScale } from "./ground";
import { SPROUT_FRAMES, SPROUT_PALETTE } from "./sprites";

// Measures an element (falls back to the window where ResizeObserver isn't available).
export function useBox() {
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

// Calls the latest version of a handler through a function whose identity never changes,
// so memoized children don't re-render just because a handler was re-created.
export function useStable(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args) => ref.current(...args), []);
}

const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };

/**
 * A walkable map on the world screen, shared by the town and the garden. The ground is painted once onto
 * a canvas at a crisp scale; `children` are the places (buttons) laid out in tile coordinates on top.
 * Keys walk Sprout only while the map has focus; tapping the ground walks there; Enter or Space on the
 * map itself calls `onInteract`.
 */
export function WorldMap({ world, walker, reduced, label, onInteract, onUnreachable, emote, children }) {
  const [screenRef, screen] = useBox();
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const mapW = world.cols * TILE;
  const mapH = world.rows * TILE;
  const scale = pixelScale(screen.w, screen.h, dpr);
  const [focused, setFocused] = useState(false);

  // Paint the ground once at 1x, then copy it up to the screen's size without smoothing.
  const ground = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = mapW;
    c.height = mapH;
    const ctx = c.getContext?.("2d");
    if (ctx) drawGround(ctx, world);
    return ctx ? c : null;
  }, [world, mapW, mapH]);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !ground || !screen.w) return;
    cv.width = Math.round(mapW * scale * dpr);
    cv.height = Math.round(mapH * scale * dpr);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ground, 0, 0, cv.width, cv.height);
  }, [ground, scale, dpr, screen.w, mapW, mapH]);

  const onKeyDown = (e) => {
    const dir = KEYS[e.key];
    if (dir) {
      e.preventDefault();
      if (!e.repeat) walker.walk(dir);
    } else if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
      e.preventDefault();
      onInteract();
    }
  };
  const onKeyUp = (e) => KEYS[e.key] && walker.release(KEYS[e.key]);

  // Tap or click the ground: Sprout walks there along the shortest path.
  const onGroundClick = (e) => {
    if (e.detail === 0) return; // keyboard "clicks" are handled by the place buttons themselves
    const r = stageRef.current.getBoundingClientRect();
    const tile = { x: Math.floor((e.clientX - r.left) / (TILE * scale)), y: Math.floor((e.clientY - r.top) / (TILE * scale)) };
    if (!walker.goTo(tile)) onUnreachable?.();
  };

  const { pos, facing, frame, target } = walker;
  const sproutRows = SPROUT_FRAMES[facing === "right" ? "left" : facing][frame];

  return (
    <div className="gw" ref={screenRef}>
      <div
        className={`gw__map${focused ? " is-focused" : ""}`}
        tabIndex={0}
        role="group"
        aria-label={label}
        aria-describedby="gw-controls"
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setFocused(false);
            walker.release();
          }
        }}
      >
        {/* Centered in whole pixels so a slightly-too-big crisp map crops evenly and stays sharp. */}
        <div
          className="gw__stage"
          ref={stageRef}
          style={{ width: mapW * scale, height: mapH * scale, left: Math.round((screen.w - mapW * scale) / 2), top: Math.round((screen.h - mapH * scale) / 2) }}
        >
          <canvas ref={canvasRef} className="gw__ground" style={{ width: mapW * scale, height: mapH * scale }} aria-hidden />
          <div className="gw__layer" style={{ width: mapW, height: mapH, transform: `scale(${scale})` }} onClick={onGroundClick}>
            {target && <span className="gw-marker" style={{ left: target.x * TILE, top: target.y * TILE }} aria-hidden />}
            {children}
            <div
              className={`gw-sprout${reduced ? " is-still" : ""}`}
              style={{ transform: `translate(${pos.x * TILE}px, ${pos.y * TILE - 3}px)`, zIndex: (pos.y + 1) * 10 + 5 }}
              aria-hidden
            >
              <div className={facing === "right" ? "gw-sprout__flip" : undefined}>
                <PixelArt rows={sproutRows} palette={SPROUT_PALETTE} size={TILE} />
              </div>
              {/* A speech bubble over Sprout, e.g. "!" when the tall grass rustles. Words say the same thing below. */}
              {emote && <span className="gw-emote">{emote}</span>}
            </div>
          </div>
        </div>
        {focused && <p className="gw-hint" aria-hidden>Arrow keys or WASD to walk · Enter to go in</p>}
      </div>
    </div>
  );
}
