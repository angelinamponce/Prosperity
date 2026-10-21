import { memo } from "react";
import { useGame } from "../game/store";
import { CaretDownFilled, CaretLeftFilled, CaretRightFilled, CaretUpFilled } from "@ant-design/icons";

const ARROWS = [
  { dir: "up", label: "Walk up", icon: <CaretUpFilled />, area: "up" },
  { dir: "left", label: "Walk left", icon: <CaretLeftFilled />, area: "left" },
  { dir: "right", label: "Walk right", icon: <CaretRightFilled />, area: "right" },
  { dir: "down", label: "Walk down", icon: <CaretDownFilled />, area: "down" },
];

/**
 * Walking onto a door or gate can swap the whole screen while a finger is still on an arrow. When the
 * finger lifts, the browser's tap "click" would land on whatever is now under it (say, a list item).
 * The arrows never use clicks, so the one that follows a press is always dropped. The window-level
 * pointerup still fires if the D-pad itself is gone.
 */
function swallowNextClick() {
  const swallow = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  document.addEventListener("click", swallow, { capture: true, once: true });
  window.addEventListener("pointerup", () => setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 400), { capture: true, once: true });
}

/**
 * An on-screen D-pad: press and hold an arrow to keep walking; A goes inside (or looks at what Sprout
 * faces). Works with touch, mouse, and keyboard (Enter or Space takes one step).
 */
export const DPad = memo(function DPad({ walk, release, interact }) {
  const hold = (dir) => (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    swallowNextClick();
    walk(dir);
  };
  const letGo = (dir) => () => release(dir);
  return (
    <div className="dpad" role="group" aria-label="D-pad">
      <div className="dpad__cross">
        {ARROWS.map((a) => (
          <button
            key={a.dir}
            type="button"
            className={`dpad__btn dpad__btn--${a.area}`}
            aria-label={a.label}
            onPointerDown={hold(a.dir)}
            onPointerUp={letGo(a.dir)}
            onPointerCancel={letGo(a.dir)}
            onLostPointerCapture={letGo(a.dir)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                walk(a.dir);
                release(a.dir);
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span aria-hidden>{a.icon}</span>
          </button>
        ))}
        <span className="dpad__hub" aria-hidden />
      </div>
      <button type="button" className="dpad__a" aria-label="A: go inside, or look at what Sprout is facing" onClick={interact}>
        A
      </button>
    </div>
  );
});

/** The controls line under the text box, the D-pad toggle (remembered), and the D-pad itself. */
export function WalkControls({ walker, interact }) {
  const game = useGame();
  const coarse = typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: coarse)").matches);
  const showPad = game?.progress.settings.dpad ?? coarse;
  return (
    <>
      <div className="gw-controls">
        <p id="gw-controls" className="gw-controls__text">
          Tap the map to walk. Keyboard: select the map, then arrows or WASD; Enter goes in.
        </p>
        <button type="button" className="gw-controls__toggle" aria-pressed={showPad} onClick={() => game?.setSetting("dpad", !showPad)}>
          {showPad ? "Hide D-pad" : "Show D-pad"}
        </button>
      </div>
      {showPad && <DPad walk={walker.walk} release={walker.release} interact={interact} />}
    </>
  );
}
