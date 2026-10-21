import { useMemo, useState } from "react";
import { HomeOutlined, LockOutlined } from "@ant-design/icons";
import { StageIcon, money, prefersReducedMotion } from "../design";
import { useGame } from "../game/store";
import { BADGES } from "../game/rules";
import { DEX } from "../game/dex";
import { gradeBreakdown } from "../dashboard/finance";
import { debtFreeSummary } from "../dashboard/summaries";
import { FOES } from "../battle/foes";
import { BANK } from "../quiz/bank";
import { GOT_DOWN_BOX, quizStats } from "../quiz/stats";
import { HandheldFrame } from "./HandheldFrame";
import { TextBox } from "./TextBox";
import { ListMenu } from "./ListMenu";
import { PixelArt } from "./PixelArt";
import { SPROUT_FRONT, SPROUT_PALETTE } from "./sprites";
import { ClassicViewButton } from "./GardenWorld";
import "./card.css";

/**
 * The Gardener Card: level, health score, the debt-free date on the saved plan, streak, the Dex and every
 * badge on one card. Each line has "Show the numbers" on the touch screen. Money never changes the
 * level; the plan numbers are shown, never scored.
 */
export default function CardScene({ profile, metrics, plan, go, query }) {
  const game = useGame();
  const instant = Boolean(game?.progress.settings.instantText) || Boolean(prefersReducedMotion());
  const returnTo = query?.get("return") || "garden";
  const [shown, setShown] = useState("intro");
  const grade = useMemo(() => gradeBreakdown(metrics), [metrics]);
  const debt = useMemo(() => debtFreeSummary(profile.debts, { extra: plan.extraDebt, strategy: plan.strategy }), [profile.debts, plan.extraDebt, plan.strategy]);

  if (!game?.ready) return <div className="px-root gw-loading" role="status">Getting your card…</div>;
  const { info, progress: p, streakNow } = game;
  const name = profile.name?.trim().split(/\s+/)[0] || "Gardener";
  const planted = DEX.filter((d) => p.terms[d.key]).length;
  const friends = FOES.filter((f) => p.quiz.befriended[f.id]).length;
  const earned = BADGES.filter((b) => p.badges[b.id]);
  const nextBadge = BADGES.find((b) => !p.badges[b.id]);
  const qs = quizStats(BANK, p.quiz);
  const debtLine = !debt.hasDebt ? "No debt" : debt.plan.date ? `${debt.plan.date}` : "Not set yet";

  const TEXT = {
    intro: `${name}'s Gardener Card. Pick a line below to see the numbers behind it.`,
    level: `Level ${info.level}, ${info.stage.label} stage, with ${info.xp} XP. ${info.maxed ? "That's the top level!" : `${info.toNext} XP to level ${info.level + 1}.`} XP comes from learning and habits, never from how much money you have.`,
    health: `Health score ${Math.round(grade.score)} out of 100 (${grade.letter}), from ${grade.parts.length} everyday habits: ${grade.parts.map((x) => `${x.label.toLowerCase()} ${Math.round(x.score)}`).join(", ")}. It's a starting point, not a judgment.`,
    debt: !debt.hasDebt
      ? debt.sentence
      : `${debt.plan.date ? `Debt-free by ${debt.plan.date} on your saved plan (${money(plan.extraDebt)} extra a month), the same plan the Debt page uses.` : `On your saved plan (${money(plan.extraDebt)} extra a month), there's no debt-free date yet.`} ${debt.sentence}`,
    streak: `${streakNow} ${streakNow === 1 ? "week" : "weeks"} in a row right now, best ${p.streak.best}. Weeks don't need to be perfect: ${p.streak.freezes} streak ${p.streak.freezes === 1 ? "freeze covers" : "freezes cover"} a quiet week.`,
    dex: `${planted} of ${DEX.length} money words planted in the Garden Dex, and ${friends} of ${FOES.length} Misconceptions befriended.`,
    quiz: `${qs.tried} of ${qs.total} quiz questions tried and ${qs.gotDown} got down (right ${GOT_DOWN_BOX} times in a row, with a longer rest each time). ${qs.topics.map((t) => `${t.topic}: ${t.answers ? `${t.correct} of ${t.answers} right` : "not tried yet"}`).join("; ")}.`,
    badges: `${earned.length} of ${BADGES.length} badges.${nextBadge ? ` A next one to try: ${nextBadge.name}. ${nextBadge.how}` : " You've earned them all!"}`,
  };

  const top = (
    <div className="gc-wrap">
      <div className="gc">
        <div className="gc__band">
          <span>Gardener Card</span>
          <span>Lv {info.level}</span>
        </div>
        <div className="gc__body">
          <div className="gc__portrait" aria-hidden>
            <PixelArt rows={SPROUT_FRONT} palette={SPROUT_PALETTE} size={64} />
          </div>
          <dl className="gc__stats">
            <div><dt>Name</dt><dd>{name}</dd></div>
            <div><dt>Stage</dt><dd>{info.stage.label}</dd></div>
            <div><dt>Health</dt><dd>{Math.round(grade.score)}/100 ({grade.letter})</dd></div>
            <div><dt>Debt-free</dt><dd>{debtLine}</dd></div>
            <div><dt>Streak</dt><dd>{streakNow} {streakNow === 1 ? "week" : "weeks"}</dd></div>
            <div><dt>Dex</dt><dd>{planted}/{DEX.length} · {friends}/{FOES.length} friends</dd></div>
            <div><dt>Quiz</dt><dd>{qs.gotDown}/{qs.total} got down</dd></div>
          </dl>
        </div>
        <ul className="gc__badges" aria-label={`Badges: ${earned.length} of ${BADGES.length} earned`}>
          {BADGES.map((b) => (
            <li key={b.id} className={p.badges[b.id] ? "is-earned" : undefined}>
              <StageIcon stage={b.icon} size={22} />
              {!p.badges[b.id] && <LockOutlined className="gc__lock" aria-hidden />}
              <span className="ps-sr-only">{b.name}: {p.badges[b.id] ? "earned" : "not yet"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const bottom = (
    <div className="gw-panel">
      <TextBox key={shown} text={TEXT[shown]} font={shown === "intro" ? "pixel" : "read"} instant={instant} />
      <ListMenu
        label="Show the numbers"
        columns={2}
        autoFocus={false}
        className="gw-goto"
        items={[
          { key: "level", label: "Level", sub: `${info.xp} XP` },
          { key: "health", label: "Health score", sub: `${Math.round(grade.score)} of 100` },
          { key: "debt", label: "Debt-free date", sub: debt.hasDebt ? `${debtLine} · saved plan` : "No debt" },
          { key: "streak", label: "Streak", sub: `Best ${p.streak.best}` },
          { key: "dex", label: "Garden Dex", sub: `${planted} planted · ${friends} befriended` },
          { key: "badges", label: "Badges", sub: `${earned.length} of ${BADGES.length}` },
          { key: "quiz", label: "Quiz stats", sub: `${qs.gotDown} got down · ${qs.tried} tried` },
        ]}
        onSelect={setShown}
      />
      {!profile.fromSurvey && <p className="gs-sample">The plan lines use sample numbers until you finish the survey.</p>}
    </div>
  );

  return (
    <HandheldFrame
      topLabel="Gardener Card"
      bottomLabel="Gardener Card details"
      top={top}
      bottom={bottom}
      toolbar={
        <>
          <button type="button" className="hh-btn" onClick={() => go(returnTo)}>
            <HomeOutlined aria-hidden /> Back
          </button>
          <ClassicViewButton go={go} />
        </>
      }
    />
  );
}
