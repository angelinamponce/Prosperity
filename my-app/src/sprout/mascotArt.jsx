import { useId } from "react";

/*
 * Placeholder artwork for Sprout. To swap in the final art, replace this file and keep the two
 * exports (FullBodyArt, HeadArt). The optional class names below are animation hooks used by
 * sprout.css; artwork without them still works, it just won't wave, blink or sway.
 *   sp-art-arm    the waving arm (rotates around its own bottom-left corner)
 *   sp-art-eyes   both eyes (blink)
 *   sp-art-leaves the leaf pair (sway)
 */

function Defs({ id }) {
  return (
    <defs>
      <linearGradient id={`${id}-body`} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#8fd3a6" />
        <stop offset="1" stopColor="#3d8a5a" />
      </linearGradient>
      <linearGradient id={`${id}-leaf`} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#3d8a5a" />
        <stop offset="1" stopColor="#7bc896" />
      </linearGradient>
    </defs>
  );
}

function Face({ cx, cy, scale = 1 }) {
  const s = (v) => v * scale;
  return (
    <g>
      <g className="sp-art-eyes">
        <circle cx={cx - s(12)} cy={cy} r={s(4.2)} fill="#173322" />
        <circle cx={cx + s(12)} cy={cy} r={s(4.2)} fill="#173322" />
        <circle cx={cx - s(10.6)} cy={cy - s(1.6)} r={s(1.3)} fill="#fff" />
        <circle cx={cx + s(13.4)} cy={cy - s(1.6)} r={s(1.3)} fill="#fff" />
      </g>
      <ellipse cx={cx - s(19)} cy={cy + s(10)} rx={s(5)} ry={s(3)} fill="#f4a38c" opacity="0.55" />
      <ellipse cx={cx + s(19)} cy={cy + s(10)} rx={s(5)} ry={s(3)} fill="#f4a38c" opacity="0.55" />
      <path
        d={`M${cx - s(7)} ${cy + s(11)} q${s(7)} ${s(6.5)} ${s(14)} 0`}
        fill="none"
        stroke="#173322"
        strokeWidth={s(2.6)}
        strokeLinecap="round"
      />
    </g>
  );
}

function Leaves({ x, y, scale = 1, id }) {
  return (
    <g className="sp-art-leaves" style={{ transformOrigin: `${x}px ${y}px` }}>
      <path d={`M${x} ${y} v${-14 * scale}`} stroke="#2f6b48" strokeWidth={4 * scale} strokeLinecap="round" />
      <path
        d={`M${x} ${y - 10 * scale}c0-${12 * scale} ${8 * scale}-${19 * scale} ${20 * scale}-${19 * scale} 0 ${12 * scale}-${8 * scale} ${19 * scale}-${20 * scale} ${19 * scale}Z`}
        fill={`url(#${id}-leaf)`}
      />
      <path
        d={`M${x} ${y - 5 * scale}c0-${10 * scale}-${6.5 * scale}-${15.5 * scale}-${16.5 * scale}-${15.5 * scale} 0 ${10 * scale} ${6.5 * scale} ${15.5 * scale} ${16.5 * scale} ${15.5 * scale}Z`}
        fill="#5fa97a"
      />
    </g>
  );
}

export function FullBodyArt() {
  const id = `spf${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 120 140" width="100%" height="100%" shapeRendering="geometricPrecision" aria-hidden>
      <Defs id={id} />
      <ellipse cx="60" cy="134" rx="30" ry="4" fill="#173322" opacity="0.12" />
      <ellipse cx="47" cy="127" rx="9" ry="5.5" fill="#275b3d" />
      <ellipse cx="73" cy="127" rx="9" ry="5.5" fill="#275b3d" />
      <path d="M28 96 q-9 6 -10 16" fill="none" stroke="#3d8a5a" strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="60" cy="88" rx="34" ry="38" fill={`url(#${id}-body)`} />
      <ellipse cx="52" cy="70" rx="14" ry="9" fill="#fff" opacity="0.18" />
      <g className="sp-art-arm">
        <path d="M91 92 q11 -5 15 -19" fill="none" stroke="#3d8a5a" strokeWidth="7" strokeLinecap="round" />
        <circle cx="106.5" cy="71" r="5" fill="#5fa97a" />
      </g>
      <Face cx={60} cy={84} />
      <Leaves x={60} y={52} id={id} />
    </svg>
  );
}

export function HeadArt() {
  const id = `sph${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 80 80" width="100%" height="100%" shapeRendering="geometricPrecision" aria-hidden>
      <Defs id={id} />
      <circle cx="40" cy="50" r="26" fill={`url(#${id}-body)`} />
      <ellipse cx="33" cy="38" rx="10" ry="6" fill="#fff" opacity="0.18" />
      <Face cx={40} cy={48} scale={0.8} />
      <Leaves x={40} y={26} scale={0.62} id={id} />
    </svg>
  );
}
