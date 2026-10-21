import { memo } from "react";
import { ART, Tile } from "../world/gardenArt";

// The landing hero's garden: a soft flat-vector sky and rolling hills, with a pixel-art meadow along
// the bottom in the same style as Garden mode. Purely decorative (aria-hidden); the slider card gives
// the meadow's text alternative. `growth` (0 to 1) comes from the sample plan's extra payment: the
// meadow is the garden that plan grows.

const SLOTS = 14;
const COLORS = ["pink", "sun", "lilac", "white"];

/**
 * What the meadow shows for a growth level: each slot goes seedling -> plant -> flower, left to right,
 * so the meadow fills in steadily and is in full bloom only at the top of the slider. Butterflies visit as it fills in.
 */
export function meadowState(growth) {
  const stages = Array.from({ length: SLOTS }, (_, i) => {
    // Slot i becomes a plant halfway through its share and blooms at the end of it, so the last
    // flower opens exactly at full growth.
    const level = growth * SLOTS - i;
    return level >= 1 ? 2 : level >= 0.5 ? 1 : 0; // 0 seedling, 1 plant, 2 flower
  });
  const blooms = stages.filter((s) => s === 2).length;
  return {
    stages,
    grown: stages.filter((s) => s > 0).length,
    blooms,
    seedlings: stages.filter((s) => s === 0).length,
    butterflies: growth >= 0.75 ? 2 : growth >= 0.35 ? 1 : 0,
  };
}

// Colours step through the list so neighbours always differ, and the every-other-plant row on phones
// still gets all four.
const colorAt = (i) => COLORS[(i + Math.floor(i / 2)) % COLORS.length];
const artFor = (stage, i) => (stage === 2 ? ART.FLOWERS[colorAt(i)] : stage === 1 ? ART.CROPS.good : ART.SEEDLING);

/** One soft cloud. */
const Cloud = ({ className }) => (
  <svg className={`lp-cloud ${className}`} viewBox="0 0 120 48" aria-hidden>
    <path d="M18 40c-9 0-15-5-15-11s6-11 14-11c2-9 11-15 21-15 9 0 17 5 20 12 3-2 7-3 11-3 11 0 19 7 19 15 8 0 14 5 14 11s-6 10-14 10H18Z" />
  </svg>
);

/** The meadow strip on its own: the fence and a row of plants. Also used under the footer CTA. */
export const Meadow = memo(function Meadow({ growth = 1, butterflies = 0, className = "" }) {
  const m = meadowState(growth);
  return (
    <div className={`lp-meadow ${className}`} aria-hidden>
      {/* A low wooden fence runs along the back of the meadow. */}
      <svg className="lp-fence" width="100%" height="22">
        <defs>
          <pattern id={`lp-fence-${className || "hero"}`} width="36" height="22" patternUnits="userSpaceOnUse">
            <rect x="2" y="2" width="6" height="20" className="lp-fence__post" />
            <rect x="0" y="7" width="36" height="4" className="lp-fence__rail" />
            <rect x="0" y="14" width="36" height="4" className="lp-fence__rail" />
          </pattern>
        </defs>
        <rect width="100%" height="22" fill={`url(#lp-fence-${className || "hero"})`} />
      </svg>
      <div className="lp-meadow__plants">
        {m.stages.map((stage, i) => (
          <span key={i} className={`lp-meadow__slot${stage === 2 ? " is-bloom" : ""}`} data-stage={stage} style={{ "--i": i }}>
            {/* Keyed by stage, so a plant that grows pops in (and a new flower glows). */}
            <span key={stage} className="lp-meadow__plant">
              <Tile rows={artFor(stage, i)} size={48} />
            </span>
          </span>
        ))}
      </div>
      {Array.from({ length: butterflies }, (_, i) => (
        <span key={i} className={`lp-butterfly lp-butterfly--${i + 1}`}>
          <Tile rows={ART.BUTTERFLY} size={32} />
        </span>
      ))}
    </div>
  );
});

export const HeroBackdrop = memo(function HeroBackdrop({ growth = 0.4 }) {
  const m = meadowState(growth);
  return (
    <div className="lp-scene" aria-hidden>
      <svg className="lp-sun" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" className="lp-sun__glow" />
        <circle cx="32" cy="32" r="14" className="lp-sun__disc" />
      </svg>
      <Cloud className="lp-cloud--a" />
      <Cloud className="lp-cloud--b" />
      <Cloud className="lp-cloud--c" />
      {/* Three hills, lighter at the back and a little deeper toward the front, and a path winding down. */}
      <svg className="lp-hills" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <path className="lp-hill lp-hill--far" d="M0 120C180 60 340 70 520 110S860 170 1040 120 1300 50 1440 80V300H0Z" />
        <path className="lp-hill lp-hill--mid" d="M0 170C220 120 420 140 640 175S1020 220 1220 170 1380 140 1440 150V300H0Z" />
        <path className="lp-hill lp-hill--near" d="M0 220C260 190 480 200 760 232S1180 262 1440 214V300H0Z" />
        <path className="lp-path" d="M300 300C380 270 470 254 560 246 640 238 700 236 760 232 700 246 640 262 590 300Z" />
      </svg>
      <Meadow growth={growth} butterflies={m.butterflies} />
    </div>
  );
});

/**
 * A gentle hill edge between sections, so the garden carries on down the page. "meadow" rolls the
 * hero's meadow down into the page; "up" rises into a softly tinted band; "down" rolls back out of it.
 */
export function HillDivider({ variant = "up" }) {
  return (
    <div className={`lp-divider lp-divider--${variant}`} aria-hidden>
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none">
        <path className="lp-divider__far" d="M0 40C200 14 400 18 640 34S1080 58 1260 34 1400 22 1440 26V64H0Z" />
        <path className="lp-divider__near" d="M0 52C260 38 520 44 780 54S1200 62 1440 48V64H0Z" />
      </svg>
    </div>
  );
}
