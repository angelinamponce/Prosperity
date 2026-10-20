import { useMemo } from "react";
import { ArrowRightOutlined, CheckOutlined, FlagFilled, SafetyOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { AnimatedNumber, Button, money } from "../../design";
import { BADGES, BadgeTile, QUIZ_TOPICS, useGame } from "../../game";
import { TOPICS } from "../../quiz/topics";
import { pickFoe } from "../../battle/foes";
import { FoeSprite } from "../../battle/sprites";
import { SproutMascot } from "../../sprout";
import { addMonths, EMERGENCY_TARGET_MONTHS, simulatePayoff } from "../finance";
import "./home.css";

const NOW = new Date();
const NO_TOPICS = {};

function CardHead({ id, title, children }) {
  return (
    <div className="hm-card-head">
      <h3 id={id} className="ps-h3">{title}</h3>
      {children}
    </div>
  );
}

// ---------- Progress cards: a picture first, the exact numbers right under it ----------

/** The emergency fund as a jar filling toward six months of essentials. */
export function SavingsJar({ m, style }) {
  const fill = Math.min(1, m.emergencyMonths / EMERGENCY_TARGET_MONTHS);
  const top = 12;
  const bottom = 92;
  const level = bottom - (bottom - top) * fill;
  return (
    <section className="ps-card hm-pcard ps-enter" style={style} aria-labelledby="hm-jar">
      <CardHead id="hm-jar" title="Emergency jar" />
      <div className="hm-pcard__visual">
        <svg viewBox="0 0 80 100" width="76" height="95" aria-hidden className="hm-jar">
          <defs>
            <clipPath id="hm-jar-clip"><path d="M18 14h44v6c8 4 10 10 10 18v46c0 6-4 10-10 10H18c-6 0-10-4-10-10V38c0-8 2-14 10-18z" /></clipPath>
          </defs>
          <rect className="hm-jar__fill" x="0" y={level} width="80" height={100 - level} clipPath="url(#hm-jar-clip)" />
          {[1, 3].map((mo) => {
            const y = bottom - ((bottom - top) * mo) / EMERGENCY_TARGET_MONTHS;
            return <line key={mo} x1="10" x2="18" y1={y} y2={y} className="hm-jar__tick" />;
          })}
          <path className="hm-jar__glass" d="M18 14h44v6c8 4 10 10 10 18v46c0 6-4 10-10 10H18c-6 0-10-4-10-10V38c0-8 2-14 10-18z" />
          <rect className="hm-jar__lid" x="16" y="6" width="48" height="9" rx="3" />
        </svg>
        <div>
          <p className="hm-pcard__big">
            <AnimatedNumber value={m.emergencyMonths} format={(v) => v.toFixed(1)} /> <span>of {EMERGENCY_TARGET_MONTHS} months</span>
          </p>
          <p className="ps-small">{money(m.emergencyBalance)} saved{m.emergencyTarget ? ` · full jar is ${money(m.emergencyTarget)}` : ""}</p>
        </div>
      </div>
      <p className="ps-small hm-pcard__note">
        {m.essential > 0 ? `One month of essentials is ${money(m.essential)}. Every month covered is a real cushion.` : "Add your costs in the survey to size your jar."}
      </p>
    </section>
  );
}

/** The road to debt-free: a flag for each debt on your plan, and the finish line. */
export function DebtPath({ profile, plan, style }) {
  const { order, months } = useMemo(() => {
    const r = simulatePayoff(profile.debts.filter((d) => d.balance > 0), { extra: plan.extraDebt, strategy: plan.strategy });
    return { order: r.payoffOrder, months: r.months };
  }, [profile.debts, plan.extraDebt, plan.strategy]);
  const owed = profile.debts.reduce((a, d) => a + d.balance, 0);
  const never = months >= 600;
  return (
    <section className="ps-card hm-pcard ps-enter" style={style} aria-labelledby="hm-path">
      <CardHead id="hm-path" title="Road to debt-free" />
      {owed <= 0 ? (
        <>
          <div className="hm-road" aria-hidden><span className="hm-road__line is-done" /><FlagFilled className="hm-road__finish" /></div>
          <p className="hm-pcard__big">No debt <span>· the road is clear</span></p>
        </>
      ) : (
        <>
          <div className="hm-road" aria-hidden>
            <span className="hm-road__line" />
            <span className="hm-road__you" title="You are here" />
            {!never &&
              order.map((d, i) => (
                <FlagFilled key={d.name} className="hm-road__flag" style={{ left: `${(d.month / months) * 100}%`, top: i % 2 ? 22 : 0 }} />
              ))}
          </div>
          <p className="hm-pcard__big">
            {never ? "Not paid off yet" : addMonths(NOW, months)} <span>{never ? "at this pace" : "on your plan"}</span>
          </p>
          <ol className="hm-road__list">
            {never ? (
              <li>Even a small extra payment can get the road moving.</li>
            ) : (
              order.map((d) => (
                <li key={d.name}><FlagFilled aria-hidden /> {d.name}: {addMonths(NOW, d.month)}</li>
              ))
            )}
          </ol>
        </>
      )}
      <p className="ps-small hm-pcard__note">
        {owed > 0 ? `${money(owed)} owed today. Your plan pays every minimum plus ${money(plan.extraDebt)} extra a month.` : "Every dollar can go toward your goals."}
      </p>
    </section>
  );
}

const VITALITY = [
  { at: 80, label: "Thriving", mood: "cheer" },
  { at: 60, label: "Growing well", mood: "wave" },
  { at: 40, label: "Growing", mood: "idle" },
  { at: 0, label: "Just getting started", mood: "idle" },
];

/** The health score as Sprout's vitality: five leaves, a friendly word, and the score itself. */
export function Vitality({ grade, style }) {
  const v = VITALITY.find((x) => grade.score >= x.at);
  const leaves = Math.round(grade.score / 20);
  return (
    <section className="ps-card hm-pcard ps-enter" style={style} aria-labelledby="hm-vital">
      <CardHead id="hm-vital" title="Sprout's vitality" />
      <div className="hm-pcard__visual">
        <SproutMascot variant="head" size={64} mood={v.mood} />
        <div>
          <p className="hm-pcard__big">{v.label}</p>
          <div className="hm-leaves" role="img" aria-label={`${leaves} of 5 leaves`}>
            {Array.from({ length: 5 }, (_, i) => (
              <svg key={i} viewBox="0 0 16 16" width="18" height="18" className={i < leaves ? "is-on" : ""} aria-hidden>
                <path d="M2 14C2 6 7 2 14 2c0 7-4 12-12 12Z" />
              </svg>
            ))}
          </div>
        </div>
      </div>
      <p className="ps-small hm-pcard__note">
        Health score <strong className="ps-num"><AnimatedNumber value={grade.score} format={(x) => Math.round(x).toString()} />/100</strong> ({grade.letter}). It's a check-up, not a judgment.
      </p>
    </section>
  );
}

/** The weekly check-in streak, with forgiving words and the freezes that cover busy weeks. */
export function StreakCard({ style }) {
  const game = useGame();
  if (!game?.ready) return null;
  const { streakNow, checkedInThisWeek, progress } = game;
  const { freezes } = progress.streak;
  return (
    <section className="ps-card hm-pcard ps-enter" style={style} aria-labelledby="hm-streak">
      <CardHead id="hm-streak" title="Weekly streak" />
      <div className="hm-pcard__visual">
        <div className="hm-weeks" role="img" aria-label={`${streakNow} ${streakNow === 1 ? "week" : "weeks"} in a row`}>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={i >= 6 - Math.min(6, streakNow) ? "is-on" : ""} />
          ))}
        </div>
        <p className="hm-pcard__big"><AnimatedNumber value={streakNow} format={(v) => String(Math.round(v))} /> <span>{streakNow === 1 ? "week" : "weeks"}</span></p>
      </div>
      <p className="ps-small hm-pcard__note">
        {checkedInThisWeek && <span className="hm-ok"><CheckOutlined aria-hidden /> Checked in this week. </span>}
        {freezes > 0 ? (
          <span><SafetyOutlined aria-hidden /> Streak freeze ready{freezes > 1 ? ` (${freezes})` : ""}: a busy week won't break it.</span>
        ) : (
          "You earn a streak freeze every 4 check-ins."
        )}
      </p>
    </section>
  );
}

// ---------- Battle shortcut, badges and words ----------

/** A quick battle, and how each quiz topic is going so far. */
export function QuizShortcut({ go, className = "", style }) {
  const game = useGame();
  const topics = game?.ready ? game.progress.quiz.topics : NO_TOPICS;
  // The topic with the most room to grow sends its Misconception.
  const weakest = useMemo(() => {
    const acc = (t) => (topics[t] ? (topics[t].correct + 1) / (topics[t].seen + 2) : 0.5);
    return [...QUIZ_TOPICS].sort((a, b) => acc(a) - acc(b))[0];
  }, [topics]);
  const foe = useMemo(() => pickFoe(weakest, () => 0), [weakest]);
  return (
    <section className={`ps-card hm-battle ${className}`} style={style} aria-labelledby="hm-battle-title">
      <div className="hm-battle__top">
        <span className="hm-battle__foe" aria-hidden><FoeSprite foe={foe} size={56} /></span>
        <div>
          <p className="ps-eyebrow">Quiz Battles</p>
          <h2 id="hm-battle-title" className="ps-h3">A question popped up nearby</h2>
          <p className="ps-small">{foe.name} has a {TOPICS[weakest].label.toLowerCase()} myth to talk through.</p>
        </div>
      </div>
      <Button icon={<ThunderboltOutlined />} onClick={() => go(`battle?topic=${weakest}`)}>Start a quick battle</Button>
      <h3 className="ps-label hm-battle__sub">Your topic strengths</h3>
      <ul className="hm-topics">
        {QUIZ_TOPICS.map((t) => {
          const s = topics[t];
          return (
            <li key={t}>
              <span className="hm-topics__name">{TOPICS[t].label}</span>
              <span className="hm-topics__bar" aria-hidden><span style={{ width: `${s ? (s.correct / s.seen) * 100 : 0}%` }} /></span>
              <span className="hm-topics__num">{s ? `${s.correct} of ${s.seen} right` : "Not tried yet"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The latest badges and the next one to earn. */
export function BadgePreview({ go, className = "", style }) {
  const game = useGame();
  if (!game?.ready) return null;
  const earned = BADGES.filter((b) => game.progress.badges[b.id]).sort((a, b) => game.progress.badges[b.id].at - game.progress.badges[a.id].at);
  const next = BADGES.find((b) => !game.progress.badges[b.id]);
  return (
    <section className={`ps-card hm-badges ${className}`} style={style} aria-labelledby="hm-badges-title">
      <div className="hm-card-head">
        <h2 id="hm-badges-title" className="ps-h3">Badges</h2>
        <span className="hm-chip">{earned.length} of {BADGES.length}</span>
      </div>
      <ul className="gm-badges hm-badges__row">
        {earned.slice(0, 3).map((b) => <BadgeTile key={b.id} badge={b} earned={game.progress.badges[b.id]} />)}
        {next && <BadgeTile key={next.id} badge={next} earned={null} />}
      </ul>
      <Button variant="ghost" size="sm" iconRight={<ArrowRightOutlined />} onClick={() => go("progress")}>See all badges</Button>
    </section>
  );
}

/** Money words learned so far. Each one also plants a flower in the garden. */
export function WordsCounter({ total, go, className = "", style }) {
  const game = useGame();
  if (!game?.ready) return null;
  const learned = Object.keys(game.progress.terms).length;
  return (
    <section className={`ps-card hm-words ${className}`} style={style} aria-labelledby="hm-words-title">
      <h2 id="hm-words-title" className="ps-h3">Money words</h2>
      <p className="hm-pcard__big"><AnimatedNumber value={learned} format={(v) => String(Math.round(v))} /> <span>of {total} learned</span></p>
      <div className="hm-topics__bar hm-words__bar" aria-hidden><span style={{ width: `${(learned / total) * 100}%` }} /></div>
      <p className="ps-small">Each word you learn plants a flower in your garden.</p>
      <Button variant="secondary" size="sm" onClick={() => go("progress")}>{learned < total ? "Learn a word" : "See all words"}</Button>
    </section>
  );
}
