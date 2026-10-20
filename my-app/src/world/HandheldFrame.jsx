import "./world.css";

/**
 * The dual-screen handheld. `top` is the world screen (scenes, battles, Sprout); `bottom` is the touch
 * screen (text, menus, details). On desktop it's a device; on phones the screens simply stack, world on top.
 * The frame is decoration only: the screens get all the room the viewport allows.
 * `paused` freezes every animation inside.
 */
export function HandheldFrame({ top, bottom, toolbar, topLabel, bottomLabel, paused }) {
  return (
    <div className={`px-root hh${paused ? " is-paused" : ""}`}>
      <div className="hh__device">
        <section className="hh__screen hh__screen--top" aria-label={topLabel}>
          {top}
        </section>
        <div className="hh__hinge">
          <span className="hh__led" aria-hidden />
          <div className="hh__toolbar">{toolbar}</div>
          <span className="hh__speaker" aria-hidden />
        </div>
        <section className="hh__screen hh__screen--bottom" aria-label={bottomLabel}>
          {bottom}
        </section>
      </div>
    </div>
  );
}
