import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightOutlined, LockOutlined } from "@ant-design/icons";
import { Button, StageIcon, useCelebration } from "../design";
import { useGame } from "./store";

const dateLabel = (at) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** One badge: a medal when earned (with the date), or a dashed outline that says how to earn it. */
export function BadgeTile({ badge, earned, as: Tag = "li" }) {
  return (
    <Tag className={`gm-badge${earned ? "" : " is-locked"}`}>
      <span className="gm-badge__medal">
        <StageIcon stage={badge.icon} size={36} />
        {!earned && <span className="gm-badge__lock"><LockOutlined aria-hidden /></span>}
      </span>
      <span className="gm-badge__name">{badge.name}</span>
      <span className="gm-badge__how">{earned ? `Earned ${dateLabel(earned.at)}` : `Not yet: ${badge.how}`}</span>
    </Tag>
  );
}

const QUIET_SOURCES = ["learnTerm", "answerQuestion", "undoMission"];

const xpLine = (info) => (info.maxed ? "Top level reached" : `${info.toNext} XP to level ${info.level + 1}`);

/** XP toward the next level. Pass `decorative` when a nearby label already says the same thing. */
export function XpBar({ info, decorative, className = "" }) {
  return (
    <div
      className={`gm-xp ${className}`}
      role={decorative ? undefined : "progressbar"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `Level ${info.level} progress`}
      aria-valuemin={decorative ? undefined : 0}
      aria-valuemax={decorative ? undefined : info.levelSize || 1}
      aria-valuenow={decorative ? undefined : info.maxed ? 1 : info.intoLevel}
      aria-valuetext={decorative ? undefined : xpLine(info)}
    >
      <div className="gm-xp__fill" style={{ width: `${Math.max(4, info.progress * 100)}%` }} />
    </div>
  );
}

/** Sprout's stage, level and XP, linking to the Progress page. `compact` is the phone top bar version. */
export function GardenerChip({ to, compact }) {
  const game = useGame();
  if (!game?.ready) return null;
  const { info } = game;
  const label = `Level ${info.level}, ${info.stage.label}. ${xpLine(info)}. See your progress`;
  if (compact) {
    return (
      <Link to={to} className="gm-chip gm-chip--compact" aria-label={label}>
        <StageIcon stage={info.stage.key} size={24} />
        <span aria-hidden>Lv {info.level}</span>
      </Link>
    );
  }
  return (
    <Link to={to} className="gm-chip" aria-label={label}>
      <span className="gm-chip__icon">
        <StageIcon stage={info.stage.key} size={34} />
      </span>
      <span className="gm-chip__body" aria-hidden>
        <span className="gm-chip__top">
          <strong>Level {info.level}</strong>
          <span>{info.stage.label}</span>
        </span>
        <XpBar info={info} decorative />
        <span className="gm-chip__meta">{xpLine(info)}</span>
      </span>
    </Link>
  );
}

// One short sentence per batch of events, e.g. "+40 XP · Weekly check-in · Badge earned: Hello, Garden".
function summarize(events) {
  const xp = events.filter((e) => e.type === "xp");
  const total = xp.reduce((a, e) => a + e.amount, 0);
  const badges = events.filter((e) => e.type === "badge").map((e) => e.badge.name);
  const main = xp.find((e) => !e.label.startsWith("Badge"))?.label;
  const parts = [`+${total} XP`];
  if (main) parts.push(main);
  if (badges.length) parts.push(`Badge earned: ${badges.join(", ")}`);
  let text = parts.join(" · ");
  if (events.some((e) => e.type === "freezeUsed")) text += ". A streak freeze covered the week you missed.";
  else if (events.some((e) => e.type === "welcomeBack")) text += ". Welcome back! A fresh streak starts today.";
  return text;
}

function StageUpDialog({ from, to, level, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d?.showModal && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="gm-stageup" aria-labelledby="gm-stageup-title" onClose={onClose} onCancel={onClose}>
      <div className="gm-stageup__art" aria-hidden>
        <span className="gm-stageup__from"><StageIcon stage={from.key} size={56} /></span>
        <ArrowRightOutlined />
        <span className="gm-stageup__to"><StageIcon stage={to.key} size={96} /></span>
      </div>
      <h2 id="gm-stageup-title" className="ps-h2">
        {to.key === "sprout" ? "Sprout just sprouted!" : `Sprout grew into a ${to.label.toLowerCase()}!`}
      </h2>
      <p className="ps-body">
        You reached level {level} by learning and checking in. Sprout keeps growing at whatever pace suits you.
      </p>
      <Button onClick={() => (ref.current?.open ? ref.current.close() : onClose())} autoFocus>
        Yay, keep growing
      </Button>
    </dialog>
  );
}

/** Turns game events into toasts and Sprout's growth celebration. Render once inside the game screen. */
export function GameFeed() {
  const game = useGame();
  const { celebrate, celebration } = useCelebration();
  const [stageUp, setStageUp] = useState(null);
  const handled = useRef(new Set());
  const batch = game?.feed[0];

  useEffect(() => {
    if (!batch) return;
    // Effects can run twice in development; each batch is celebrated once.
    if (handled.current.has(batch.id)) return;
    handled.current.add(batch.id);
    const { events, source } = batch;
    const big = events.find((e) => e.type === "stageUp");
    const notable = events.some((e) => e.type === "badge" || e.type === "levelUp");
    // New words and quiz answers show their XP right where they happen, so they only get a toast for a badge or level.
    if (!QUIET_SOURCES.includes(source) || notable || big) celebrate({ message: summarize(events) });
    if (big) setStageUp({ ...big, level: events.find((e) => e.type === "levelUp")?.level });
    game.takeFeed(batch.id);
  }, [batch, celebrate, game]);

  return (
    <>
      {celebration}
      {stageUp && <StageUpDialog {...stageUp} onClose={() => setStageUp(null)} />}
    </>
  );
}
