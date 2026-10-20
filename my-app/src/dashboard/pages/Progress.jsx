import { Link } from "react-router-dom";
import { CheckOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { Button, Card, StageIcon, STAGES } from "../../design";
import { BADGES, CHECKINS_PER_FREEZE, LEVEL_XP, MAX_FREEZES, XP, XpBar, useGame } from "../../game";
import { EmptyState, PageHeader } from "../components";
import { Explain, GLOSSARY } from "../glossary";

const Done = ({ children = "Done" }) => (
  <span className="gm-done">
    <CheckOutlined aria-hidden /> {children}
  </span>
);

const dateLabel = (at) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function Progress({ onReplayTour }) {
  const game = useGame();
  if (!game?.ready) return <EmptyState title="Getting your garden ready…" />;

  const { info, progress: p, streakNow, checkedInThisWeek } = game;
  const termCount = Object.keys(GLOSSARY).length;
  const learned = Object.keys(p.terms).length;
  const earned = BADGES.filter((b) => p.badges[b.id]);

  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title="Your garden journey"
        description="Sprout grows as you learn and check in. How much money you have never changes your level, so there's no wrong way to play."
      />

      <div className="db-grid">
        <Card className="span-12 ps-enter" title="Sprout's growth">
          <div className="gm-hero">
            <div className="gm-hero__art">
              <StageIcon stage={info.stage.key} size={88} label={`Sprout is a ${info.stage.label.toLowerCase()}`} />
            </div>
            <div>
              <div className="gm-hero__level">
                <span className="ps-h2">Level {info.level}</span>
                <span className="ps-body">· {info.stage.label} · {info.xp} XP total</span>
              </div>
              <XpBar info={info} className="gm-xp--lg" />
              <p className="ps-small">
                {info.maxed
                  ? "Sprout is fully grown. Everything you learn from here is a bonus."
                  : `${info.toNext} XP to level ${info.level + 1}.${
                      info.nextStage ? ` Sprout becomes a ${info.nextStage.label.toLowerCase()} at ${info.nextStageXp} XP.` : ""
                    }`}
              </p>
            </div>
          </div>
          <ol className="gm-stages" aria-label="Growth stages">
            {STAGES.map((s, i) => {
              const atLevel = i * 2 + 1;
              const current = i === info.stageIndex;
              const locked = i > info.stageIndex;
              return (
                <li key={s.key} className={`gm-stage${current ? " is-current" : ""}${locked ? " is-locked" : ""}`} aria-current={current ? "step" : undefined}>
                  <StageIcon stage={s.key} size={40} />
                  <strong>{s.label}</strong>
                  <span>{current ? "Now" : locked ? `Level ${atLevel} · ${LEVEL_XP[atLevel - 1]} XP` : "Grown"}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <div className="db-grid">
        <Card className="span-7 ps-enter" style={{ "--i": 1 }} title="Ways to earn XP" subtitle="Every bit of learning counts">
          <ul className="gm-earn">
            <li>
              <span className="gm-earn__xp">+{XP.surveyDone}</span>
              <div>
                <div className="gm-earn__title">Finish your money survey</div>
                <div className="ps-small">Your plan is built from your answers.</div>
              </div>
              {p.flags.surveyDone ? <Done /> : <Link to="/signup" className="ps-btn ps-btn--secondary ps-btn--sm">Start</Link>}
            </li>
            <li>
              <span className="gm-earn__xp">+{XP.termLearned}</span>
              <div>
                <div className="gm-earn__title">Learn a money word</div>
                <div className="ps-small">Tap any ? next to a word. {learned} of {termCount} learned.</div>
              </div>
              {learned >= termCount ? <Done>All learned</Done> : <a href="#money-words" className="ps-btn ps-btn--secondary ps-btn--sm">Learn one</a>}
            </li>
            <li>
              <span className="gm-earn__xp">+{XP.checkIn}</span>
              <div>
                <div className="gm-earn__title">Check in once a week</div>
                <div className="ps-small">Just open your dashboard. That's it.</div>
              </div>
              {checkedInThisWeek && <Done>This week</Done>}
            </li>
            <li>
              <span className="gm-earn__xp">+{XP.tourDone}</span>
              <div>
                <div className="gm-earn__title">Take the dashboard tour</div>
                <div className="ps-small">A quick look at where everything lives.</div>
              </div>
              {p.flags.tourDone ? <Done /> : <Button variant="secondary" size="sm" onClick={onReplayTour}>Start tour</Button>}
            </li>
            <li>
              <span className="gm-earn__xp">+{XP.badge}</span>
              <div>
                <div className="gm-earn__title">Earn a badge</div>
                <div className="ps-small">Each badge below says how to earn it.</div>
              </div>
              <span className="ps-small">{earned.length} of {BADGES.length}</span>
            </li>
          </ul>
        </Card>

        <Card className="span-5 ps-enter" style={{ "--i": 2 }} title="Weekly check-in streak" subtitle="Gentle by design">
          <div className="gm-streak">
            <span className="gm-streak__num">{streakNow}</span>
            <span className="ps-body">{streakNow === 1 ? "week" : "weeks"} in a row</span>
          </div>
          <p className="ps-small" style={{ marginTop: 4 }}>Best: {p.streak.best} {p.streak.best === 1 ? "week" : "weeks"} · {p.streak.total} check-ins in all</p>
          <div className="gm-freezes" role="img" aria-label={`${p.streak.freezes} of ${MAX_FREEZES} streak freezes saved`}>
            {Array.from({ length: MAX_FREEZES }, (_, i) => (
              <span key={i} className={`gm-freeze${i < p.streak.freezes ? "" : " is-empty"}`}>
                <SafetyOutlined aria-hidden />
              </span>
            ))}
          </div>
          <p className="ps-small">
            Busy week? A streak freeze covers it automatically, so your streak keeps going. You get a new freeze every {CHECKINS_PER_FREEZE} check-ins.
          </p>
        </Card>
      </div>

      <div className="db-grid">
        <Card className="span-12 ps-enter" style={{ "--i": 3 }} title="Badges" subtitle={`${earned.length} of ${BADGES.length} earned`}>
          <ul className="gm-badges">
            {BADGES.map((b) => {
              const got = p.badges[b.id];
              return (
                <li key={b.id} className={`gm-badge${got ? "" : " is-locked"}`}>
                  <span className="gm-badge__medal">
                    <StageIcon stage={b.icon} size={36} />
                    {!got && <span className="gm-badge__lock"><LockOutlined aria-hidden /></span>}
                  </span>
                  <span className="gm-badge__name">{b.name}</span>
                  <span className="gm-badge__how">{got ? `Earned ${dateLabel(got.at)}` : `Not yet: ${b.how}`}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="db-grid">
        <Card id="money-words" className="span-12 ps-enter" style={{ "--i": 4, scrollMarginTop: 80 }} title="Money words" subtitle={`${learned} of ${termCount} learned. Tap a ? to read one.`}>
          <ul className="gm-words">
            {Object.keys(GLOSSARY).map((k) => (
              <li key={k} className={p.terms[k] ? "is-learned" : undefined}>
                <Explain k={k} />
                {p.terms[k] && <Done>Learned</Done>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
