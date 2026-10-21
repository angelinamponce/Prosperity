import { useEffect } from "react";
import { useGame } from "../game/store";
import { setSoundEnabled } from "./sound";
import "./world.css";

/**
 * The dual-screen handheld. `top` is the world screen (scenes, battles, Sprout); `bottom` is the touch
 * screen (text, menus, details). On desktop it's a device; on phones the screens simply stack, world on top.
 * The frame is decoration only: the screens get all the room the viewport allows.
 * `paused` freezes every animation inside. The hinge (with its toolbar) comes first in the page so
 * keyboard and screen-reader users reach Classic View or Pause first; CSS keeps it between the screens.
 */
export function HandheldFrame({ top, bottom, toolbar, topLabel, bottomLabel, paused }) {
  // Sound effects follow the player's setting (off by default) and only while a Garden-mode screen is open.
  const game = useGame();
  const soundOn = Boolean(game?.progress.settings.sound);
  useEffect(() => {
    setSoundEnabled(soundOn);
    return () => setSoundEnabled(false);
  }, [soundOn]);
  return (
    <div className={`px-root hh${paused ? " is-paused" : ""}`}>
      <div className="hh__device">
        <div className="hh__hinge">
          <span className="hh__led" aria-hidden />
          <div className="hh__toolbar">{toolbar}</div>
          <span className="hh__speaker" aria-hidden />
        </div>
        <section className="hh__screen hh__screen--top" aria-label={topLabel}>
          {top}
        </section>
        <section className="hh__screen hh__screen--bottom" aria-label={bottomLabel}>
          {bottom}
        </section>
      </div>
    </div>
  );
}
