import { FullBodyArt, HeadArt } from "./mascotArt";

/**
 * Sprout, the Prosperity money guide.
 * variant: "full" (whole body) or "head" (round avatar)
 * mood:    "idle" (blinks, leaves sway), "wave" (waves hello), "thinking" (gentle bob)
 * label:   pass a label when the mascot stands alone; leave it out when nearby text already says "Sprout".
 * All motion stops when the visitor prefers reduced motion (see sprout.css).
 */
export default function SproutMascot({ variant = "full", mood = "idle", size = 64, label, className = "" }) {
  const Art = variant === "head" ? HeadArt : FullBodyArt;
  const height = variant === "head" ? size : Math.round(size * (140 / 120));
  return (
    <span
      className={`sp-mascot sp-mascot--${variant} sp-mascot--${mood} ${className}`}
      style={{ width: size, height }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Art />
    </span>
  );
}
