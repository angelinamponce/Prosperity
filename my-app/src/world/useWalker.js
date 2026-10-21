import { useCallback, useEffect, useRef, useState } from "react";
import { directionTo, pathToward, step } from "./movement";

export const STEP_MS = 160;
// With reduced motion, Sprout moves a tile at a time with no walk cycle or sliding.
export const REDUCED_STEP_MS = 70;

/**
 * Walks Sprout around town. `walk(dir)` / `release(dir)` for held keys and the D-pad; `goTo(tile, then)`
 * for tap-to-move (follows the shortest path, then calls `then`); `stop()` clears everything.
 * `world` is the map being walked (the town or the garden).
 * Walking up through a door calls `onEnter(building)`. Stops whenever the tab is hidden.
 */
export function useWalker({ world, start, reduced, onEnter, onArrive }) {
  const [pos, setPos] = useState(start);
  const [facing, setFacing] = useState("down");
  const [frame, setFrame] = useState(0); // 0 standing, 1 and 2 the walking steps
  const [target, setTarget] = useState(null); // the tapped destination, for its marker

  const posRef = useRef(start);
  const moving = useRef(false);
  const held = useRef(null);
  const route = useRef([]);
  const then = useRef(null);
  const timer = useRef(null);
  const steps = useRef(0);
  const opts = useRef({});
  opts.current = { world, reduced, onEnter, onArrive };

  const halt = useRef(() => {});
  const advance = useRef(() => {});

  halt.current = () => {
    clearTimeout(timer.current);
    moving.current = false;
    held.current = null;
    route.current = [];
    then.current = null;
    setFrame(0);
    setTarget(null);
  };

  const attempt = (dir) => {
    setFacing(dir);
    const r = step(opts.current.world, posRef.current, dir);
    if (!r.moved) {
      moving.current = false;
      if (r.enter) {
        halt.current();
        opts.current.onEnter?.(r.enter);
      } else {
        route.current = [];
        then.current = null;
        setTarget(null);
        setFrame(0);
      }
      return;
    }
    moving.current = true;
    posRef.current = r.pos;
    setPos(r.pos);
    steps.current += 1;
    setFrame(opts.current.reduced ? 0 : (steps.current % 2) + 1);
    timer.current = setTimeout(() => {
      moving.current = false;
      opts.current.onArrive?.(r.pos);
      advance.current();
    }, opts.current.reduced ? REDUCED_STEP_MS : STEP_MS);
  };

  advance.current = () => {
    if (route.current.length) {
      attempt(directionTo(posRef.current, route.current.shift()));
      return;
    }
    if (then.current) {
      const fn = then.current;
      then.current = null;
      setFrame(0);
      setTarget(null);
      fn();
      return;
    }
    if (held.current) {
      attempt(held.current);
      return;
    }
    setFrame(0);
    setTarget(null);
  };

  const walk = useCallback((dir) => {
    route.current = [];
    then.current = null;
    setTarget(null);
    held.current = dir;
    if (!moving.current) attempt(dir);
    // attempt only reads refs and stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const release = useCallback((dir) => {
    if (!dir || held.current === dir) held.current = null;
  }, []);

  /** Walks to `tile` (or as near as possible). Returns false if there's no way there. */
  const goTo = useCallback((tile, onDone) => {
    held.current = null;
    const path = pathToward(opts.current.world, posRef.current, tile);
    if (!path) return false;
    route.current = path;
    then.current = onDone ?? null;
    setTarget(path.length ? path[path.length - 1] : null);
    if (!moving.current) advance.current();
    return true;
  }, []);

  const face = useCallback((dir) => setFacing(dir), []);
  const stop = useCallback(() => halt.current(), []);

  // Pause when the tab is hidden: no timers keep running in the background.
  useEffect(() => {
    const onVis = () => document.hidden && halt.current();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearTimeout(timer.current);
    };
  }, []);

  return { pos, facing, frame, target, walk, release, goTo, face, stop, posRef };
}
