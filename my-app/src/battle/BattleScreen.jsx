import { useEffect, useState } from "react";
import { AnimatedNumber, prefersReducedMotion } from "../design";
import { useGame } from "../game/store";
import { answerXpPreview } from "../game/rules";
import { BANK } from "../quiz/bank";
import { DIFFICULTY, TOPICS } from "../quiz/topics";
import { seededRandom, selectQuestions } from "../quiz/select";
import { answer, askSprout, assistsFor, currentQuestion, next, resolveQuestion, startSession, summary, takeHint } from "../quiz/session";
import { SproutMascot } from "../sprout";
import { HandheldFrame } from "../world/HandheldFrame";
import { ListMenu } from "../world/ListMenu";
import { TextBox } from "../world/TextBox";
import { pickFoe } from "./foes";
import { FoeSprite } from "./sprites";
import "./battle.css";

// A wild encounter has as many questions as the Misconception has strength.
export const STRENGTH = 3;

/** Picks a topic (the requested one, or what the player most needs), a Misconception, and its questions. */
export function setupBattle({ quiz, level, topic, ctx, now = Date.now() }) {
  const rng = seededRandom(now);
  const t = TOPICS[topic] ? topic : selectQuestions(BANK, quiz, { count: 1, level, now, rng })[0]?.topic ?? "budgeting";
  const picked = selectQuestions(BANK, quiz, { count: STRENGTH, topic: t, level, now, rng });
  return { topic: t, foe: pickFoe(t, rng), questions: picked.map((q) => resolveQuestion(q, ctx, now % 100000)) };
}

const say = (text, extra) => ({ text, font: "pixel", ...extra });
const read = (text, extra) => ({ text, font: "read", ...extra });

function numbersLine(q, fromSurvey) {
  if (!q.numbers) return null;
  const source = q.example ? "Example numbers" : fromSurvey ? "Your numbers" : "Sample plan numbers";
  return read(`${source}: ${q.numbers.map((n) => `${n.label} ${n.value}`).join(" · ")}`);
}

function Battle({ game, profile, metrics, query, given, onExit, onAgain }) {
  const [setup] = useState(
    () => given ?? setupBattle({ quiz: game.progress.quiz, level: game.info.level, topic: query?.get("topic"), ctx: { profile, metrics } })
  );
  const { foe } = setup;
  const instant = Boolean(game.progress.settings.instantText) || Boolean(prefersReducedMotion());
  const [session, setSession] = useState(() => startSession(setup.questions, { mode: "battle", topic: setup.topic }));
  const [strength, setStrength] = useState(setup.questions.length);
  const opening = (q) => (q?.myth ? [say(`“${q.myth}”`, { speaker: foe.name })] : []);
  const [talk, setTalk] = useState(() => ({
    lines: [say(`${foe.name} ${foe.intro}`), ...opening(currentQuestion(session))],
    i: 0,
    then: "menu",
  }));
  const [phase, setPhase] = useState(instant ? "talk" : "intro"); // intro, talk, menu, answers, end
  const [fx, setFx] = useState({ n: 0, kind: null }); // kind: "hit" | "wilt"
  const [paused, setPaused] = useState(false);
  const [xpWon, setXpWon] = useState(0);
  const [ending, setEnding] = useState(null); // "befriended" | "wandered"

  const q = currentQuestion(session);
  const assists = q ? assistsFor(session, q.id) : { hint: false, sprout: false };
  const preview = q ? answerXpPreview(game.progress, q, assists, Date.now()) : null;
  const { info } = game;

  // P pauses anywhere; Esc pauses from the command menu.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "p" || e.key === "P") setPaused((p) => !p);
      else if (e.key === "Escape" && paused) setPaused(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused]);

  const speak = (lines, then) => {
    setTalk({ lines: lines.filter(Boolean), i: 0, then });
    setPhase("talk");
  };

  const finishTalk = (then) => {
    if (then === "exit") return onExit();
    if (then === "nextQuestion") {
      const s = next(session);
      setSession(s);
      if (strength === 0) {
        setEnding("befriended");
        return speak([say(`${foe.name} ${foe.befriend}`), say(`You befriended ${foe.name}!`)], "end");
      }
      if (s.phase === "done") {
        setEnding("wandered");
        return speak([say(`${foe.name} wandered off to think it over.`), say("No worries. It'll be back, and so will those questions.")], "end");
      }
      return speak(opening(currentQuestion(s)).length ? opening(currentQuestion(s)) : [say(`${foe.name} has another question!`)], "menu");
    }
    setPhase(then);
  };

  const advance = () => (talk.i + 1 < talk.lines.length ? setTalk({ ...talk, i: talk.i + 1 }) : finishTalk(talk.then));

  const onCommand = (key) => {
    if (key === "answer") return setPhase("answers");
    if (key === "toolshed") {
      setSession(takeHint(session));
      return speak([read(`Toolshed hint: ${q.hint}`), numbersLine(q, profile.fromSurvey)], "menu");
    }
    if (key === "sprout") {
      if (assists.sprout) return speak([say("I already ruled one out. You've got this!", { speaker: "Sprout" })], "menu");
      const s = askSprout(session);
      setSession(s);
      return speak([say(`Hmm… I'm pretty sure it's not “${q.choices[s.eliminated[q.id]]}”.`, { speaker: "Sprout" })], "menu");
    }
    if (key === "leave") return speak([say("Good call taking a break. See you soon!", { speaker: "Sprout" })], "exit");
    return undefined;
  };

  const onAnswer = (key) => {
    const s = answer(session, Number(key));
    if (s === session) return;
    game.dispatch({ type: "answerQuestion", ...s.last });
    setSession(s);
    const right = q.choices[q.correct];
    const assume = q.assumption && read(`Assumption: ${q.assumption}`);
    if (s.last.correct) {
      setStrength((n) => n - 1);
      setXpWon((x) => x + preview.xp);
      setFx((f) => ({ n: f.n + 1, kind: "hit" }));
      speak(
        [
          say("Sprout thinks it through…"),
          say(`That's right: “${right}”`),
          read(q.explain),
          assume,
          say(preview.xp ? `Sprout gained ${preview.xp} XP!` : "Sprout already knew this one, so no XP this time."),
        ],
        "nextQuestion"
      );
    } else {
      setFx((f) => ({ n: f.n + 1, kind: "wilt" }));
      speak(
        [
          say("Not quite! Sprout wilts a little…"),
          read(`The answer is “${right}”.`),
          read(q.explain),
          assume,
          s.last.comingBack && say(`${foe.name} will bring this one up again later.`),
          say("Sprout perks right back up!"),
        ],
        "nextQuestion"
      );
    }
  };

  // ---------- Top screen ----------
  const helped = assists.hint || assists.sprout;
  const top = (
    <div className={`bt-scene${ending ? ` is-${ending}` : ""}`}>
      <div className="bt-sky" aria-hidden />
      <div className="bt-field" aria-hidden />

      <div className="bt-plate bt-plate--foe">
        <div className="bt-plate__row">
          <span className="bt-plate__name">{foe.name}</span>
          <span className="bt-plate__lv">{TOPICS[setup.topic].label}{q ? ` · ${DIFFICULTY[q.difficulty]}` : ""}</span>
        </div>
        <div className="bt-bar">
          <span className="bt-bar__label">Myth</span>
          <span className="bt-bar__track"><span className="bt-bar__fill" style={{ width: `${(strength / setup.questions.length) * 100}%` }} /></span>
        </div>
        <span className="bt-plate__num">Strength {strength}/{setup.questions.length}</span>
      </div>
      <div className="bt-pad bt-pad--foe" aria-hidden />
      <div className="bt-foe" aria-hidden>
        <div key={`foe-${fx.n}`} className={`bt-foe__body${fx.kind === "hit" ? " fx-hit" : ""}`}>
          <FoeSprite foe={foe} size={128} />
        </div>
      </div>

      <div className="bt-pad bt-pad--sprout" aria-hidden />
      <div className="bt-sprout" aria-hidden>
        <div key={`sp-${fx.n}`} className={`bt-sprout__body${fx.kind === "hit" ? " fx-lunge" : fx.kind === "wilt" ? " fx-wilt" : ""}`}>
          <SproutMascot variant="full" size={96} mood={ending === "befriended" ? "cheer" : "idle"} />
        </div>
      </div>
      <div className="bt-plate bt-plate--sprout">
        <div className="bt-plate__row">
          <span className="bt-plate__name">Sprout</span>
          <span className="bt-plate__lv">Lv {info.level}</span>
        </div>
        <div className="bt-bar">
          <span className="bt-bar__label">XP</span>
          <span className="bt-bar__track"><span className="bt-bar__fill bt-bar__fill--xp" style={{ width: `${Math.max(3, info.progress * 100)}%` }} /></span>
        </div>
        <span className="bt-plate__num">
          {info.maxed ? "Max level" : <><AnimatedNumber value={info.intoLevel} format={(v) => String(Math.round(v))} />/{info.levelSize} XP</>}
        </span>
      </div>

      {phase === "intro" && (
        <div className="bt-wipe" aria-hidden onAnimationEnd={(e) => e.target.classList.contains("bt-wipe__bar--last") && setPhase("talk")}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className={`bt-wipe__bar${i === 7 ? " bt-wipe__bar--last" : ""}`} style={{ "--i": i }} />
          ))}
        </div>
      )}
    </div>
  );

  // ---------- Bottom screen ----------
  let bottom;
  if (paused) {
    bottom = (
      <div className="bt-pause">
        <TextBox text="Paused. Take all the time you need." instant />
        <ListMenu
          label="Pause menu"
          items={[
            { key: "resume", label: "Resume" },
            { key: "instant", label: `Instant text: ${game.progress.settings.instantText ? "On" : "Off"}`, sub: "Show whole lines at once" },
            { key: "leave", label: "Leave battle", sub: "No penalty" },
          ]}
          onSelect={(k) => {
            if (k === "resume") setPaused(false);
            if (k === "instant") game.setSetting("instantText", !game.progress.settings.instantText);
            if (k === "leave") onExit();
          }}
          onBack={() => setPaused(false)}
        />
      </div>
    );
  } else if (phase === "end") {
    const sum = summary(session);
    bottom = (
      <>
        <TextBox
          font="read"
          instant
          text={`${ending === "befriended" ? `You befriended ${foe.name}!` : `${foe.name} will be back another time.`} You got ${sum.correct} of ${sum.total} right on the first try${sum.fixedOnRetry ? ` and fixed ${sum.fixedOnRetry} on a second look` : ""}.${xpWon ? ` +${xpWon} XP.` : ""}`}
        />
        <ListMenu
          label="What next?"
          columns={2}
          items={[{ key: "again", label: "Battle again" }, { key: "quizzes", label: "Back to quizzes" }]}
          onSelect={(k) => (k === "again" ? onAgain() : onExit())}
        />
      </>
    );
  } else if (phase === "talk" || phase === "intro") {
    const line = talk.lines[talk.i];
    bottom = <TextBox key={talk.i + line.text} {...line} instant={instant} paused={phase === "intro"} waiting={phase === "talk"} onContinue={advance} />;
  } else if (phase === "menu") {
    bottom = (
      <>
        <TextBox text={q.prompt} instant={instant} speaker={foe.name} />
        <ListMenu
          label="Command menu"
          columns={2}
          items={[
            { key: "answer", label: "Answer" },
            { key: "toolshed", label: "Toolshed", sub: assists.hint ? "Hint shown" : "Free hint" },
            { key: "sprout", label: "Ask Sprout", sub: assists.sprout ? "Already helped" : "Rule one out" },
            { key: "leave", label: "Leave", sub: "No penalty" },
          ]}
          onSelect={onCommand}
          onBack={() => setPaused(true)}
        />
        <p className="bt-note">
          {preview.due
            ? `Worth ${preview.xp} XP${helped ? ` (full: ${preview.full})` : ""}. Help is free; it just lowers this to 75%, or 50% with both.`
            : "You answered this one recently, so no XP this time. It still counts as practice!"}
        </p>
      </>
    );
  } else if (phase === "answers") {
    const out = session.eliminated[q.id];
    bottom = (
      <>
        <TextBox text={q.prompt} instant speaker={foe.name} />
        <ListMenu
          label="Choose an answer. Press Escape to go back."
          columns={2}
          className="lm--read bt-answers"
          items={q.choices.map((c, i) => ({
            key: String(i),
            label: c,
            sub: `${TOPICS[q.topic].label} · ${preview.xp} XP`,
            disabled: i === out,
            note: i === out ? "Sprout ruled this out" : undefined,
          }))}
          onSelect={onAnswer}
          onBack={() => setPhase("menu")}
        />
      </>
    );
  }

  return (
    <HandheldFrame
      topLabel={`Battle: Sprout and ${foe.name}`}
      bottomLabel="Battle controls"
      paused={paused}
      top={top}
      bottom={bottom}
      toolbar={
        <>
          <button type="button" className="hh-btn" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? "▶ Resume" : "❚❚ Pause"}
          </button>
          <button type="button" className="hh-btn" onClick={onExit}>Leave</button>
        </>
      }
    />
  );
}

/**
 * Quiz Battles. Runs the same quiz session, questions and progress as the Classic quiz page, shown as a
 * turn-based battle. `query` may carry ?topic=; `setup` overrides the questions (tests, Greenhouse keepers).
 */
export default function BattleScreen({ profile, metrics, go, query, setup }) {
  const game = useGame();
  const [round, setRound] = useState(0);
  if (!game?.ready) {
    return (
      <div className="px-root bt-loading" role="status">
        Getting the battle ready…
      </div>
    );
  }
  return (
    <Battle
      key={round}
      game={game}
      profile={profile}
      metrics={metrics}
      query={query}
      given={round === 0 ? setup : undefined}
      onExit={() => go("quiz")}
      onAgain={() => setRound((r) => r + 1)}
    />
  );
}
