import { useMemo, useRef, useState } from "react";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useGame } from "../game/store";
import { almanacCards } from "../game/almanac";
import { pickQuest } from "../game/quest";
import { buildRecommendations } from "../dashboard/finance";
import { DASHBOARD_TERMS, GLOSSARY } from "../dashboard/glossary";
import { BANK } from "../quiz/bank";
import { dueCounts } from "../quiz/select";
import "./almanac.css";

const WORDS = [...DASHBOARD_TERMS, ...Object.keys(GLOSSARY).filter((k) => !DASHBOARD_TERMS.includes(k))].map((key) => ({ key, ...GLOSSARY[key] }));
const KEY = "prosperity.almanac.card";

// Which card was showing last, in this browser only (a convenience; it's fine if storage is off).
const readCard = () => {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
};
const saveCard = (i) => {
  try {
    localStorage.setItem(KEY, String(i));
  } catch {
    // Storage can be unavailable; the Almanac still works.
  }
};

/**
 * The Garden Almanac: a small card on the touch screen in Garden mode. The player flips the cards with
 * the arrow buttons; nothing changes on its own. The card's text is announced when it changes.
 */
export function Almanac({ profile, metrics, plan, onMissions }) {
  const game = useGame();
  const [i, setI] = useState(readCard);
  const nextRef = useRef(null);
  const recs = useMemo(() => buildRecommendations(profile, metrics, plan).filter((r) => r.habit), [profile, metrics, plan]);
  if (!game?.ready) return null;
  const p = game.progress;
  const quest = pickQuest({
    fromSurvey: Boolean(profile.fromSurvey),
    recs,
    progress: p,
    words: WORDS,
    dueCount: Object.values(dueCounts(BANK, p.quiz)).reduce((a, b) => a + b, 0),
  });
  const cards = almanacCards({ quest, streakNow: game.streakNow, best: p.streak.best, checkedIn: game.checkedInThisWeek, debts: profile.debts, plan, info: game.info });
  const n = cards.length;
  const at = ((i % n) + n) % n;
  const card = cards[at];
  const flip = (d) => {
    const next = (((at + d) % n) + n) % n;
    setI(next);
    saveCard(next);
  };

  return (
    <section className="al" aria-label="Garden Almanac">
      <button type="button" className="al__flip" aria-label="Previous card" onClick={() => flip(-1)}>
        <LeftOutlined aria-hidden />
      </button>
      <div className="al__card" aria-live="polite" aria-atomic="true">
        <p className="al__label">
          {card.label} <span className="al__count">· {at + 1} of {n}</span>
        </p>
        <p className="al__title">{card.title}</p>
        <p className="al__body">{card.body}</p>
        {card.key === "streak" && !game.checkedInThisWeek && (
          <button
            type="button"
            className="al__open"
            onClick={() => {
              game.checkIn();
              // The button goes away once checked in, so keep keyboard focus in the Almanac.
              nextRef.current?.focus();
            }}
          >
            Check in this week
          </button>
        )}
        {card.key === "mission" && onMissions && (
          <button type="button" className="al__open" onClick={onMissions}>
            Open missions
          </button>
        )}
      </div>
      <button ref={nextRef} type="button" className="al__flip" aria-label="Next card" onClick={() => flip(1)}>
        <RightOutlined aria-hidden />
      </button>
    </section>
  );
}
