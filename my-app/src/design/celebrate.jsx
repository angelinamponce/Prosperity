import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { prefersReducedMotion } from "./hooks";

const LEAF = "M0 0c0-5 3.3-8 8.2-8 0 5-3.3 8-8.2 8Z";
const COLORS = ["var(--ps-brand-300)", "var(--ps-brand-400)", "var(--ps-brand-500)", "var(--ps-brand-600)", "#e2c068"];

/** A small sprout that grows: stem draws up, then two leaves unfurl. */
export function Sprout({ size = 40, className = "" }) {
  return (
    <svg className={`ps-sprout ${className}`} width={size} height={size} viewBox="0 0 32 32" aria-hidden shapeRendering="geometricPrecision">
      <path className="ps-sprout__stem" d="M16 27V14" pathLength="1" />
      <path className="ps-sprout__leaf ps-sprout__leaf--r" d="M16 16c0-4.6 3-7.2 7.6-7.2 0 4.6-3 7.2-7.6 7.2Z" />
      <path className="ps-sprout__leaf ps-sprout__leaf--l" d="M16 19.5c0-3.7-2.4-5.8-6.1-5.8 0 3.7 2.4 5.8 6.1 5.8Z" />
    </svg>
  );
}

function makeParticles(count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (-165 + Math.random() * 150) * (Math.PI / 180); // an upward fan
    const dist = 90 + Math.random() * 150;
    return {
      key: i,
      leaf: i % 3 !== 0,
      color: COLORS[i % COLORS.length],
      style: {
        "--dx": `${Math.cos(angle) * dist}px`,
        "--dy": `${Math.sin(angle) * dist}px`,
        "--r": `${Math.round(Math.random() * 540 - 270)}deg`,
        "--s": (0.7 + Math.random() * 0.7).toFixed(2),
        animationDelay: `${Math.round(Math.random() * 120)}ms`,
      },
    };
  });
}

/**
 * const { celebrate, celebration } = useCelebration();
 * celebrate({ message, origin }) bursts leaves from `origin` (an element) and shows a friendly toast.
 * Render {celebration} once in the component. With reduced motion, only the toast appears.
 */
export function useCelebration() {
  const [bursts, setBursts] = useState([]);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const celebrate = useCallback(({ message, origin } = {}) => {
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    const r = origin?.getBoundingClientRect?.();
    if (r && r.width) {
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    const id = `${Date.now()}-${Math.random()}`;
    const particles = prefersReducedMotion() ? [] : makeParticles(26);
    // One toast at a time; a newer milestone replaces the older one.
    setBursts((b) => [...b.map((z) => ({ ...z, message: null })), { id, x, y, particles, message }]);
    timers.current.push(setTimeout(() => setBursts((b) => b.filter((z) => z.id !== id)), 3600));
  }, []);

  const celebration = createPortal(
    <div className="ps-celebrate" aria-live="polite">
      {bursts.map((b) => (
        <div key={b.id}>
          <div className="ps-celebrate__origin" style={{ left: b.x, top: b.y }}>
            {b.particles.map((p) =>
              p.leaf ? (
                <svg key={p.key} className="ps-celebrate__bit" style={p.style} width="14" height="14" viewBox="-1 -9 10 10" aria-hidden>
                  <path d={LEAF} fill={p.color} />
                </svg>
              ) : (
                <span key={p.key} className="ps-celebrate__bit ps-celebrate__dot" style={{ ...p.style, background: p.color }} />
              )
            )}
          </div>
          {b.message && (
            <div className="ps-celebrate__toast" role="status">
              <Sprout size={34} />
              <span>{b.message}</span>
            </div>
          )}
        </div>
      ))}
    </div>,
    document.body
  );

  return { celebrate, celebration };
}

/**
 * Calls onCross(threshold) when `value` rises past one of `thresholds`.
 * Never fires on first render, so it rewards changes the user makes, not page loads.
 */
export function useMilestone(value, thresholds, onCross) {
  const prev = useRef(value);
  const cb = useRef(onCross);
  cb.current = onCross;
  useEffect(() => {
    const crossed = thresholds.filter((t) => prev.current < t && value >= t);
    prev.current = value;
    if (crossed.length) cb.current(Math.max(...crossed));
    // thresholds are constant literals at each call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}
