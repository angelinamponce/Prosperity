import { STAGES, StageIcon } from "../design";

const PLANTS = 5;

/**
 * A small garden bed for the hero preview. `growth` (0 to 1) is how much of the slider's possible time
 * savings the chosen extra payment reaches. Plants grow one stage at a time from left to right, so every
 * slider step shows a change.
 */
export default function HeroGarden({ growth }) {
  const level = growth * (STAGES.length - 1) * 2;
  const stages = Array.from({ length: PLANTS }, (_, i) => Math.max(0, Math.min(STAGES.length - 1, Math.floor(level - i))));
  const grown = stages.filter((s) => s > 0).length;
  return (
    <div
      className="lp-garden"
      role="img"
      aria-label={`Sample garden: ${grown} of ${PLANTS} plants growing. It grows as the extra payment brings the debt-free date closer.`}
    >
      {stages.map((s, i) => (
        <span key={i} className="lp-garden__plot">
          {/* Keyed by stage so each new stage pops in. */}
          <span key={s} className="lp-garden__plant">
            <StageIcon stage={STAGES[s].key} size={40} />
          </span>
        </span>
      ))}
    </div>
  );
}
