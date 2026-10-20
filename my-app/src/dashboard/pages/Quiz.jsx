import { useEffect, useRef, useState } from "react";
import { ArrowRightOutlined, BulbOutlined, CheckCircleFilled, CloseCircleFilled, ScissorOutlined } from "@ant-design/icons";
import { Badge, Button, Card } from "../../design";
import { ASSIST_SHARE, QUIZ_TOPICS, answerXpPreview, useGame } from "../../game";
import { BANK } from "../../quiz/bank";
import { DIFFICULTY, TOPICS } from "../../quiz/topics";
import { dueCounts, seededRandom, selectQuestions } from "../../quiz/select";
import { answer, assistsFor, askSprout, currentQuestion, next, resolveQuestion, startSession, summary, takeHint } from "../../quiz/session";
import { SproutMascot } from "../../sprout";
import { EmptyState, PageHeader } from "../components";
import { Explain } from "../glossary";
import "../../quiz/quiz.css";

const QUESTIONS_PER_QUIZ = 5;
const sharePct = (k) => `${Math.round(ASSIST_SHARE[k] * 100)}%`;

function TopicMenu({ quiz, onStart }) {
  const due = dueCounts(BANK, quiz);
  const totals = BANK.reduce((a, q) => ({ ...a, [q.topic]: (a[q.topic] ?? 0) + 1 }), {});
  return (
    <>
      <Card className="ps-enter qz-start" title="Quick quiz" subtitle={`${QUESTIONS_PER_QUIZ} questions picked for you, from every topic`}>
        <p className="ps-body">
          Questions you've missed come back later so they stick, and new ones match your level. There's no timer, and a wrong answer never costs anything.
        </p>
        <Button iconRight={<ArrowRightOutlined />} onClick={() => onStart(null)}>Start a quick quiz</Button>
      </Card>
      <ul className="qz-topics">
        {QUIZ_TOPICS.map((t, i) => {
          const s = quiz.topics[t];
          return (
            <li key={t} className="ps-card qz-topic ps-enter" style={{ "--i": i + 1 }}>
              <h2 className="ps-h3">{TOPICS[t].label}</h2>
              <p className="ps-small">{TOPICS[t].blurb}</p>
              <p className="qz-topic__stats">
                {s ? `${s.correct} of ${s.seen} answers right` : "Not tried yet"} · {due[t] ?? 0} of {totals[t]} ready to practice
              </p>
              <Button variant="secondary" size="sm" onClick={() => onStart(t)} aria-label={`Practice ${TOPICS[t].label}`}>
                Practice
              </Button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function XpTag({ preview, assists }) {
  if (!preview.due) return <Badge className="qz-xp">Answered recently · no XP this time</Badge>;
  const helped = assists.hint || assists.sprout;
  return <Badge tone="brand" className="qz-xp">Worth {preview.xp} XP{helped ? ` (full: ${preview.full})` : ""}</Badge>;
}

function numbersSource(q, fromSurvey) {
  if (q.example) return "Example numbers";
  return fromSurvey ? "From your survey answers" : "From the sample plan";
}

function QuestionView({ session, setSession, game, profile, onLeave, onEarn }) {
  const q = currentQuestion(session);
  const [choice, setChoice] = useState(null);
  const [result, setResult] = useState(null); // { correct, xp, preview }
  const headRef = useRef(null);
  const feedbackRef = useRef(null);
  const assists = assistsFor(session, q.id);
  const feedback = session.phase === "feedback";
  // Once answered, keep the tag as it was at that moment; recording the answer would otherwise change it.
  const preview = feedback && result ? result.preview : answerXpPreview(game.progress, q, assists, Date.now());
  const eliminated = session.eliminated[q.id];
  const asked = session.queue.length;

  useEffect(() => {
    setChoice(null);
    setResult(null);
    headRef.current?.focus();
  }, [session.pos]);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  const check = () => {
    if (choice == null) return;
    const s = answer(session, choice);
    const earned = s.last.correct ? preview.xp : 0;
    setResult({ correct: s.last.correct, xp: earned, preview });
    onEarn(earned);
    game.dispatch({ type: "answerQuestion", ...s.last });
    setSession(s);
  };

  return (
    <Card className="qz-card ps-enter">
      <div className="qz-meta">
        <span className="ps-small">Question {session.pos + 1} of {asked}</span>
        <div className="qz-meta__tags">
          <Badge>{TOPICS[q.topic].label}</Badge>
          <Badge>{DIFFICULTY[q.difficulty]}</Badge>
          <XpTag preview={preview} assists={assists} />
        </div>
      </div>
      <div className="qz-progress" aria-hidden>
        <div style={{ width: `${(session.pos / asked) * 100}%` }} />
      </div>

      {q.myth && (
        <p className="qz-myth">
          <span className="ps-eyebrow">Common myth</span>
          “{q.myth}”
        </p>
      )}

      <fieldset className="qz-choices" disabled={feedback}>
        <legend>
          <h2 className="ps-h2 qz-prompt" ref={headRef} tabIndex={-1}>{q.prompt}</h2>
        </legend>
        {q.choices.map((c, i) => {
          const out = i === eliminated;
          const state = feedback ? (i === q.correct ? "right" : i === choice ? "wrong" : "") : "";
          return (
            <label key={i} className={`qz-choice${out ? " is-out" : ""}${state ? ` is-${state}` : ""}${choice === i ? " is-picked" : ""}`}>
              <input type="radio" name={`q-${q.id}-${session.pos}`} value={i} checked={choice === i} disabled={out} onChange={() => setChoice(i)} />
              <span className="qz-choice__letter" aria-hidden>{"ABCD"[i]}</span>
              <span className="qz-choice__text">
                {c}
                {out && <span className="qz-choice__note">Sprout ruled this one out</span>}
                {state === "right" && <span className="qz-choice__note">Correct answer</span>}
                {state === "wrong" && <span className="qz-choice__note">Your answer</span>}
              </span>
              {state === "right" && <CheckCircleFilled className="qz-choice__icon" aria-hidden />}
              {state === "wrong" && <CloseCircleFilled className="qz-choice__icon" aria-hidden />}
            </label>
          );
        })}
      </fieldset>

      {assists.hint && (
        <div className="qz-hint" role="note">
          <p><BulbOutlined aria-hidden /> <strong>Toolshed hint:</strong> {q.hint}</p>
          {q.numbers && (
            <dl className="qz-numbers">
              <span className="ps-eyebrow">{numbersSource(q, profile.fromSurvey)}</span>
              {q.numbers.map((n) => (
                <div key={n.label}><dt>{n.label}</dt><dd>{n.value}</dd></div>
              ))}
            </dl>
          )}
        </div>
      )}

      {!feedback ? (
        <>
          <div className="qz-actions">
            <Button onClick={check} disabled={choice == null}>Check answer</Button>
            <Button variant="secondary" icon={<BulbOutlined />} onClick={() => setSession(takeHint(session))} disabled={assists.hint}>
              {assists.hint ? "Hint shown" : "Show a hint"}
            </Button>
            <Button variant="secondary" icon={<ScissorOutlined />} onClick={() => setSession(askSprout(session))} disabled={assists.sprout}>
              {assists.sprout ? "Sprout helped" : "Ask Sprout to rule one out"}
            </Button>
            <Button variant="ghost" onClick={onLeave}>End quiz</Button>
          </div>
          <p className="ps-small qz-help-note">
            Help is always free. It just lowers what this question earns: one kind of help gives {sharePct("one")} of the XP, both give {sharePct("both")}.
          </p>
        </>
      ) : (
        <div className={`qz-feedback ${result?.correct ? "is-right" : "is-wrong"}`}>
          <SproutMascot variant="head" size={48} mood={result?.correct ? "cheer" : "thinking"} />
          <div className="qz-feedback__body">
            <h3 className="ps-h3" ref={feedbackRef} tabIndex={-1}>
              {result?.correct
                ? result.xp > 0
                  ? `Nice work! +${result.xp} XP`
                  : "Correct! (No XP this time, since you answered it recently.)"
                : "Not quite, and that's how learning works."}
            </h3>
            {!result?.correct && <p className="ps-body"><strong>The answer:</strong> {q.choices[q.correct]}</p>}
            <p className="ps-body">{q.explain}</p>
            {q.assumption && <p className="ps-small qz-assume"><strong>Assumption:</strong> {q.assumption}</p>}
            {q.term && <p className="ps-small qz-term">Money word: <Explain k={q.term} /></p>}
            {session.last?.comingBack && <p className="ps-small">This one will come back in a few questions, so it sticks.</p>}
            <Button iconRight={<ArrowRightOutlined />} onClick={() => setSession(next(session))}>
              {session.pos + 1 >= asked ? "See results" : "Next question"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Results({ session, xp, onAgain, onMenu }) {
  const s = summary(session);
  const headRef = useRef(null);
  useEffect(() => headRef.current?.focus(), []);
  const great = s.correct === s.total;
  return (
    <Card className="qz-card ps-enter">
      <div className="qz-result">
        <SproutMascot variant="full" size={72} mood={great ? "cheer" : "wave"} />
        <div>
          <h2 className="ps-h2" ref={headRef} tabIndex={-1}>
            {great ? "A perfect round!" : s.correct > 0 ? "Nice round!" : "Thanks for practicing!"}
          </h2>
          <p className="ps-body">
            You got {s.correct} of {s.total} right on the first try
            {s.fixedOnRetry ? `, and fixed ${s.fixedOnRetry} more on a second look` : ""}. {xp > 0 ? `+${xp} XP this quiz.` : ""}
          </p>
        </div>
      </div>
      <ol className="qz-review">
        {s.byQuestion.map((e) => (
          <li key={e.id} className={e.correct ? "is-right" : "is-wrong"}>
            {e.correct ? <CheckCircleFilled aria-hidden /> : <CloseCircleFilled aria-hidden />}
            <span>
              <span className="ps-sr-only">{e.correct ? "Right: " : "Missed: "}</span>
              {e.question.prompt}
              {!e.correct && <span className="ps-small"> {e.retryCorrect ? "Got it on the second try." : "It'll come back in a future quiz."}</span>}
            </span>
          </li>
        ))}
      </ol>
      <div className="qz-actions">
        <Button iconRight={<ArrowRightOutlined />} onClick={onAgain}>Another quiz</Button>
        <Button variant="secondary" onClick={onMenu}>Back to topics</Button>
      </div>
    </Card>
  );
}

export default function Quiz({ profile, metrics }) {
  const game = useGame();
  const [session, setSession] = useState(null);
  const [xp, setXp] = useState(0);
  const [seed] = useState(() => Date.now() % 100000);
  if (!game?.ready) return <EmptyState title="Getting your quizzes ready…" />;

  const start = (topic) => {
    const now = Date.now();
    const picked = selectQuestions(BANK, game.progress.quiz, { count: QUESTIONS_PER_QUIZ, topic, level: game.info.level, now, rng: seededRandom(now) });
    setXp(0);
    setSession(startSession(picked.map((q) => resolveQuestion(q, { profile, metrics }, seed)), { topic }));
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <PageHeader
        eyebrow="Quizzes"
        title={session ? (session.topic ? `${TOPICS[session.topic].label} quiz` : "Quick quiz") : "Money quizzes"}
        description="Short questions in plain English. Every answer explains the math behind it."
      />
      {!session && <TopicMenu quiz={game.progress.quiz} onStart={start} />}
      {session && session.phase !== "done" && (
        <QuestionView
          session={session}
          setSession={setSession}
          game={game}
          profile={profile}
          onLeave={() => setSession(null)}
          onEarn={(n) => setXp((x) => x + n)}
        />
      )}
      {session?.phase === "done" && <Results session={session} xp={xp} onAgain={() => start(session.topic)} onMenu={() => setSession(null)} />}
    </>
  );
}
