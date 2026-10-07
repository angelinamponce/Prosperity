import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../design";
import "./intro.css";

const SEEN_KEY = "prosperity.introSeen";
const GROW_MS = 2400; // seed, stem, leaves, wordmark, short hold
const SETTLE_MS = 700; // sprout flies to the navbar logo
const SKIP_SETTLE_MS = 450;

// Decided once, before first paint, so returning visitors never see a flash of the intro.
export function shouldPlayIntro() {
  if (prefersReducedMotion()) return false;
  try {
    return sessionStorage.getItem(SEEN_KEY) !== "1";
  } catch {
    return false;
  }
}

/**
 * Full-screen intro: a seed sprouts into the Prosperity logo, then flies into the navbar.
 * phase: "playing" -> "settling" -> onPhase("done").
 * targetRef points at the navbar logo so the sprout can land exactly on it.
 */
export default function Intro({ phase, onPhase, targetRef }) {
  const markRef = useRef(null);
  const timers = useRef([]);
  const [settleStyle, setSettleStyle] = useState(null);
  const [fast, setFast] = useState(false);

  const settle = useCallback(
    (quick = false) => {
      if (phase !== "playing") return;
      timers.current.forEach(clearTimeout);
      const from = markRef.current?.getBoundingClientRect();
      const to = targetRef.current?.getBoundingClientRect();
      if (from && to && from.width) {
        // Animate real position and size (not a scale transform) so the SVG is redrawn
        // as crisp vectors every frame instead of a shrinking bitmap.
        const box = (r) => ({ left: r.left, top: r.top, width: r.width, height: r.height });
        setSettleStyle({ position: "fixed", ...box(from), transition: "none" });
        requestAnimationFrame(() => requestAnimationFrame(() => setSettleStyle({ position: "fixed", ...box(to) })));
      }
      setFast(quick);
      onPhase("settling");
      // Normally the flight's transitionend finishes the intro; this timer is the fallback.
      timers.current = [setTimeout(() => onPhase("done"), (quick ? SKIP_SETTLE_MS : SETTLE_MS) + 250)];
    },
    [phase, onPhase, targetRef]
  );

  // Start the clock, remember the visit, and keep the page still while the intro plays.
  useEffect(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage unavailable: the intro may replay next time, which is harmless.
    }
    window.scrollTo(0, 0);
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const t = timers.current;
    t.push(setTimeout(() => settle(false), GROW_MS));
    return () => {
      root.style.overflow = prevOverflow;
      t.forEach(clearTimeout);
    };
    // Runs once on mount; settle reads the latest phase via its own closure when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any key skips.
  useEffect(() => {
    if (phase !== "playing") return undefined;
    const onKey = () => settle(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, settle]);

  return (
    <div
      className={`lp-intro is-${phase}${fast ? " is-fast" : ""}`}
      onClick={() => settle(true)}
      aria-hidden={phase !== "playing"}
    >
      <div className="lp-intro__center">
        <div className="lp-intro__slot">
          <div
            className="lp-intro__mark"
            ref={markRef}
            style={settleStyle ?? undefined}
            onTransitionEnd={(e) => {
              if (phase === "settling" && e.target === markRef.current && e.propertyName === "left") onPhase("done");
            }}
          >
          <svg viewBox="0 0 32 32" aria-hidden shapeRendering="geometricPrecision">
            <defs>
              <linearGradient id="lp-intro-tile" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--ps-brand-500)" />
                <stop offset="1" stopColor="var(--ps-brand-700)" />
              </linearGradient>
            </defs>
            <rect className="lp-intro__tile" width="32" height="32" rx="9" />
            <ellipse className="lp-intro__seed" cx="16" cy="25.4" rx="1.8" ry="1.3" />
            <path className="lp-intro__stem" d="M16 25V14" pathLength="1" />
            <path className="lp-intro__leaf lp-intro__leaf--r" d="M16 16c0-4.6 3-7.2 7.6-7.2 0 4.6-3 7.2-7.6 7.2Z" />
            <path className="lp-intro__leaf lp-intro__leaf--l" d="M16 19.5c0-3.7-2.4-5.8-6.1-5.8 0 3.7 2.4 5.8 6.1 5.8Z" />
          </svg>
        </div>
        </div>
        <p className="lp-intro__word">Prosperity</p>
      </div>
      <button
        type="button"
        className="ps-btn ps-btn--ghost ps-btn--sm lp-intro__skip"
        onClick={(e) => {
          e.stopPropagation();
          settle(true);
        }}
      >
        Skip intro
      </button>
    </div>
  );
}
