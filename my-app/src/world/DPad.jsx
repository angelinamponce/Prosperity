import { memo } from "react";
import { CaretDownFilled, CaretLeftFilled, CaretRightFilled, CaretUpFilled } from "@ant-design/icons";

const ARROWS = [
  { dir: "up", label: "Walk up", icon: <CaretUpFilled />, area: "up" },
  { dir: "left", label: "Walk left", icon: <CaretLeftFilled />, area: "left" },
  { dir: "right", label: "Walk right", icon: <CaretRightFilled />, area: "right" },
  { dir: "down", label: "Walk down", icon: <CaretDownFilled />, area: "down" },
];

/**
 * An on-screen D-pad: press and hold an arrow to keep walking; A goes inside (or looks at what Sprout
 * faces). Works with touch, mouse, and keyboard (Enter or Space takes one step).
 */
export const DPad = memo(function DPad({ walk, release, interact }) {
  const hold = (dir) => (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
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
