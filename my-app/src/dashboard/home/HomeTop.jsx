import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightOutlined, CheckOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { Button, Calc, StageIcon } from "../../design";
import { XpBar, useGame } from "../../game";
import { SproutMascot } from "../../sprout";
import "./home.css";

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** "Good morning, Sam", with Sprout's stage, level and an XP bar that always shows its numbers. */
export function Greeting({ name }) {
  const game = useGame();
  const first = name?.split(" ")[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const info = game?.ready ? game.info : null;
  return (
    <header className="hm-hello ps-enter">
      <div className="hm-hello__sprout">
        <SproutMascot variant="full" size={80} mood="wave" />
        {info && (
          <span className="hm-hello__stage">
            <StageIcon stage={info.stage.key} size={20} />
            {info.stage.label}
          </span>
        )}
      </div>
      <div className="hm-hello__text">
        <p className="ps-eyebrow">{today}</p>
        <h1 className="ps-h1">{first ? `${greeting()}, ${first}` : `${greeting()}!`}</h1>
        <p className="ps-body">Here's one small step for today, and your plan in plain English.</p>
        {info && (
          <div className="hm-hello__xp">
            <span className="hm-hello__level">Level {info.level}</span>
            <XpBar info={info} className="hm-hello__bar" />
            <span className="ps-num ps-small">{info.maxed ? "Top level" : `${info.intoLevel}/${info.levelSize} XP`}</span>
          </div>
        )}
      </div>
    </header>
  );
}

/** The one recommended next step, with its reward and time, and one obvious button. */
export function TodaysQuest({ quest, go, className = "", style }) {
  const game = useGame();
  const [cheer, setCheer] = useState("");

  const learn = () => {
    game.learnTerm(quest.word.key, quest.word.title);
    setCheer(`Nice! You learned “${quest.word.title}” (+10 XP). Here's your next quest.`);
  };
  const didIt = () => {
    game.dispatch({ type: "completeMission", id: quest.mission.id, title: quest.mission.title });
    setCheer("Nice work! That habit counts. Here's your next quest.");
  };

  let primary;
  if (quest.action.to) {
    primary = (
      <Link to={quest.action.to} className="ps-btn ps-btn--primary">
        {quest.action.label} <ArrowRightOutlined aria-hidden />
      </Link>
    );
  } else if (quest.action.learn) {
    primary = <Button icon={<CheckOutlined />} onClick={learn}>{quest.action.label}</Button>;
  } else {
    primary = <Button iconRight={<ArrowRightOutlined />} onClick={() => go(quest.action.page)}>{quest.action.label}</Button>;
  }

  return (
    <section className={`ps-card hm-quest ${className}`} style={style} aria-labelledby="hm-quest-title">
      <p className="hm-quest__cheer" role="status">{cheer}</p>
      <div className="hm-quest__top">
        <span className="ps-eyebrow">Today's quest</span>
        <span className="hm-quest__chips">
          <span className="hm-chip">{quest.xp}</span>
          <span className="hm-chip hm-chip--plain"><ClockCircleOutlined aria-hidden /> {quest.time}</span>
        </span>
      </div>
      <h2 id="hm-quest-title" className="ps-h2">{quest.title}</h2>
      <p className="ps-body">{quest.why}</p>
      {quest.impact && <p className="ps-small hm-quest__impact">What it could mean for you: {quest.impact}</p>}
      <div className="hm-quest__actions">
        {primary}
        {quest.mission && (
          <Button variant="secondary" icon={<CheckOutlined />} onClick={didIt}>
            I did this
          </Button>
        )}
      </div>
      {quest.mission && (
        <p className="ps-small hm-quest__honor">
          Honor system: tap “I did this” once you've done it (“{quest.mission.habit}”). You can undo it anytime under Your next steps.
        </p>
      )}
    </section>
  );
}

/** Two or three plain sentences from the plan. Every number can be tapped to see how it was worked out. */
export function SummaryStrip({ sentences, fromSurvey, className = "", style }) {
  return (
    <section className={`ps-card hm-summary ${className}`} style={style} aria-labelledby="hm-summary-title">
      <h2 id="hm-summary-title" className="ps-eyebrow">Your plan in plain English</h2>
      <ul className="hm-summary__list">
        {sentences.map((parts, i) => (
          <li key={i}>
            {parts.map((p, j) => (typeof p === "string" ? <span key={j}>{p}</span> : <Calc key={j} {...p} />))}
          </li>
        ))}
      </ul>
      <p className="ps-small">
        Tap an underlined number to see the math.{fromSurvey ? "" : " These are sample numbers."}
      </p>
    </section>
  );
}

const FIRST_STEPS = [
  { stage: "seed", title: "Plant a seed", body: "Answer a short survey about your money." },
  { stage: "sprout", title: "Watch it sprout", body: "We turn your answers into a plan." },
  { stage: "tree", title: "Grow your plan", body: "Take small steps and watch Sprout grow." },
];

/** What a signed-in player sees before the survey: Sprout guiding the first step, never empty charts. */
export function FirstStep({ onExplore, onQuiz }) {
  return (
    <div className="hm-first ps-enter">
      <SproutMascot variant="full" size={96} mood="wave" />
      <h1 className="ps-h1">Welcome! Let's plant your first seed.</h1>
      <p className="ps-body">Your dashboard grows from your survey answers. It takes about five minutes, and you can change anything later.</p>
      <div className="ps-card hm-first__card">
        <div className="hm-quest__top">
          <span className="ps-eyebrow">Your first quest</span>
          <span className="hm-quest__chips">
            <span className="hm-chip">+50 XP</span>
            <span className="hm-chip hm-chip--plain"><ClockCircleOutlined aria-hidden /> About 5 min</span>
          </span>
        </div>
        <h2 className="ps-h2">Finish your money survey</h2>
        <ol className="hm-first__steps">
          {FIRST_STEPS.map((s, i) => (
            <li key={s.title} className={i === 0 ? "is-current" : undefined}>
              <StageIcon stage={s.stage} size={32} />
              <span>
                <strong>{s.title}</strong>
                <span className="ps-small">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <Link to="/signup" className="ps-btn ps-btn--primary ps-btn--block">
          Finish my survey <ArrowRightOutlined aria-hidden />
        </Link>
      </div>
      <div className="hm-first__more">
        <Button variant="ghost" onClick={onExplore}>Explore with sample numbers</Button>
        <Button variant="ghost" onClick={onQuiz}>Try a quick money quiz</Button>
      </div>
    </div>
  );
}
