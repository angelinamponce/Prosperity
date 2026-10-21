import { memo } from "react";
import { ART, Tile } from "../world/gardenArt";

// The landing hero's garden: a soft flat-vector sky and rolling hills, with a pixel-art meadow along
// the bottom in the same style as Garden mode. Purely decorative (aria-hidden); the interactive parts
// (Sprout, the slider card) sit on top of it. `growth` (0 to 1) is how far the meadow has grown.

// Meadow slots across the width: each grows from a seedling to a crop and then a flower as `growth`
// rises, left to right, so every step of growth changes something.
const SLOTS = 14;
const COLORS = ["pink", "sun", "lilac", "white"];

function slotArt(i, growth) {
  const level = growth * SLOTS * 2 - i; // each slot takes two steps: crop, then bloom
  if (level >= 1.5) return ART.FLOWERS[COLORS[i % COLORS.length]];
  if (level >= 0.5) return ART.CROPS.good;
  return ART.SEEDLING;
}

/** One soft cloud. */
const Cloud = ({ className }) => (
  <svg className={`lp-cloud ${className}`} viewBox="0 0 120 48" aria-hidden>
    <path d="M18 40c-9 0-15-5-15-11s6-11 14-11c2-9 11-15 21-15 9 0 17 5 20 12 3-2 7-3 11-3 11 0 19 7 19 15 8 0 14 5 14 11s-6 10-14 10H18Z" />
  </svg>
);

export const HeroBackdrop = memo(function HeroBackdrop({ growth = 0.4 }) {
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
      <div className="lp-meadow">
        {/* A low wooden fence runs along the back of the meadow. */}
        <svg className="lp-fence" width="100%" height="22">
          <defs>
            <pattern id="lp-fence" width="36" height="22" patternUnits="userSpaceOnUse">
              <rect x="2" y="2" width="6" height="20" className="lp-fence__post" />
              <rect x="0" y="7" width="36" height="4" className="lp-fence__rail" />
              <rect x="0" y="14" width="36" height="4" className="lp-fence__rail" />
            </pattern>
          </defs>
          <rect width="100%" height="22" fill="url(#lp-fence)" />
        </svg>
        <div className="lp-meadow__plants">
          {Array.from({ length: SLOTS }, (_, i) => (
            <span key={i} className="lp-meadow__slot">
              <Tile rows={slotArt(i, growth)} size={48} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});
