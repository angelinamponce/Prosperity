// Sprout's growth stages as small icons. The landing quest map uses them now; the XP system reuses them.
export const STAGES = [
  { key: "seed", label: "Seed" },
  { key: "sprout", label: "Sprout" },
  { key: "sapling", label: "Sapling" },
  { key: "young", label: "Young tree" },
  { key: "tree", label: "Full tree" },
];

const STEM = { fill: "none", stroke: "var(--ps-brand-600)", strokeWidth: 2.2, strokeLinecap: "round" };
const ground = <path d="M6 27.5h20" stroke="var(--ps-brand-200)" strokeWidth="2" strokeLinecap="round" />;

const ART = {
  seed: (
    <>
      {ground}
      <ellipse cx="16" cy="23.5" rx="4.2" ry="3.2" fill="var(--ps-brand-700)" />
      <path d="M16 20.5c0-2.2 1.4-3.4 3.6-3.4 0 2.2-1.4 3.4-3.6 3.4Z" fill="var(--ps-brand-400)" />
    </>
  ),
  sprout: (
    <>
      {ground}
      <path d="M16 27V16" {...STEM} />
      <path d="M16 17.5c0-4.2 2.8-6.6 7-6.6 0 4.2-2.8 6.6-7 6.6Z" fill="var(--ps-brand-500)" />
      <path d="M16 20.5c0-3.4-2.2-5.3-5.6-5.3 0 3.4 2.2 5.3 5.6 5.3Z" fill="var(--ps-brand-400)" />
    </>
  ),
  sapling: (
    <>
      {ground}
      <path d="M16 27V9" {...STEM} />
      <path d="M16 11c0-3.6 2.4-5.6 6-5.6 0 3.6-2.4 5.6-6 5.6Z" fill="var(--ps-brand-500)" />
      <path d="M16 14.5c0-3.2-2.1-5-5.3-5 0 3.2 2.1 5 5.3 5Z" fill="var(--ps-brand-400)" />
      <path d="M16 19c0-3.4 2.2-5.3 5.6-5.3 0 3.4-2.2 5.3-5.6 5.3Z" fill="var(--ps-brand-400)" />
      <path d="M16 22.5c0-2.8-1.8-4.4-4.6-4.4 0 2.8 1.8 4.4 4.6 4.4Z" fill="var(--ps-brand-300)" />
    </>
  ),
  young: (
    <>
      {ground}
      <path d="M16 27V16" {...STEM} strokeWidth="2.8" />
      <circle cx="16" cy="12.5" r="7" fill="var(--ps-brand-500)" />
      <circle cx="13.5" cy="10.5" r="2.4" fill="var(--ps-brand-300)" opacity="0.6" />
    </>
  ),
  tree: (
    <>
      {ground}
      <path d="M16 27V17M16 21l-3.5-3M16 19.5l3-2.5" {...STEM} strokeWidth="3" />
      <circle cx="10.5" cy="13" r="5.5" fill="var(--ps-brand-600)" />
      <circle cx="21.5" cy="13" r="5.5" fill="var(--ps-brand-600)" />
      <circle cx="16" cy="9" r="7" fill="var(--ps-brand-500)" />
      <circle cx="13.5" cy="7" r="2.4" fill="var(--ps-brand-300)" opacity="0.6" />
    </>
  ),
};

/** Decorative unless `label` is given, e.g. <StageIcon stage="sapling" label="Sapling stage" />. */
export function StageIcon({ stage = "seed", size = 32, label, className = "" }) {
  return (
    <svg
      className={`ps-stage ${className}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      shapeRendering="geometricPrecision"
    >
      {ART[stage] ?? ART.seed}
    </svg>
  );
}
