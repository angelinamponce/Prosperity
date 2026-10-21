import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckOutlined, HomeOutlined } from "@ant-design/icons";
import { prefersReducedMotion } from "../design";
import { useGame } from "../game/store";
import { XP } from "../game/rules";
import { pickQuest } from "../game/quest";
import { buildRecommendations } from "../dashboard/finance";
import { DASHBOARD_TERMS, GLOSSARY } from "../dashboard/glossary";
import { BANK } from "../quiz/bank";
import { dueCounts } from "../quiz/select";
import { HandheldFrame } from "./HandheldFrame";
import { TextBox } from "./TextBox";
import { ListMenu } from "./ListMenu";
import { ClassicViewButton } from "./GardenWorld";
import "./card.css";

const WORDS = [...DASHBOARD_TERMS, ...Object.keys(GLOSSARY).filter((k) => !DASHBOARD_TERMS.includes(k))].map((key) => ({ key, ...GLOSSARY[key] }));

/**
 * Missions in Garden mode: today's quest pinned to the quest board, and the plan's habit missions with
 * the same "I did this" and Undo as the Classic dashboard (honor system; a mission never holds more than
 * its XP, so undo and redo can't add up). Missions reward habits, never dollar amounts.
 */
export default function MissionsScene({ profile, metrics, plan, go, query }) {
  const game = useGame();
  const instant = Boolean(game?.progress.settings.instantText) || Boolean(prefersReducedMotion());
  const returnTo = query?.get("return") || "garden";
  const [pick, setPick] = useState("today");
  const [cheer, setCheer] = useState("");
  const recs = useMemo(() => buildRecommendations(profile, metrics, plan).filter((r) => r.habit), [profile, metrics, plan]);

  if (!game?.ready) return <div className="px-root gw-loading" role="status">Getting your missions…</div>;
  const p = game.progress;
  const guest = game.id === "guest";
  const done = recs.filter((r) => p.missions[r.id]?.done).length;
  const quest = pickQuest({
    fromSurvey: Boolean(profile.fromSurvey),
    recs,
    progress: p,
    words: WORDS,
    dueCount: Object.values(dueCounts(BANK, p.quiz)).reduce((a, b) => a + b, 0),
  });
  const rec = recs.find((r) => r.id === pick);

  // Today's quest's own button, sending Garden-mode battles back here.
  const questAction = () => {
    if (quest.action.learn) {
      game.learnTerm(quest.word.key, quest.word.title);
      return setCheer(`Nice! You learned “${quest.word.title}” (+${XP.termLearned} XP).`);
    }
    if (quest.action.page === "battle") return go(`battle?from=garden`);
    return go(quest.action.page);
  };
  const toggle = () => {
    if (p.missions[rec.id]?.done) {
      game.dispatch({ type: "undoMission", id: rec.id });
      return setCheer("Undone. That mission's XP was taken back, so it's fair either way.");
    }
    game.dispatch({ type: "completeMission", id: rec.id, title: rec.title });
    return setCheer(`Nice work! That habit counts. +${XP.mission} XP`);
  };

  const text = rec
    ? `${rec.title}. ${rec.because} The habit: “${rec.habit}”. ${p.missions[rec.id]?.done ? "You marked this done." : `Tap “I did this” once you have (+${XP.mission} XP, honor system).`}`
    : `Today's quest: ${quest.title}. ${quest.why} (${quest.xp} · ${quest.time})`;

  const top = (
    <div className="mq-wrap">
      <div className="mq-board" aria-hidden>
        <div className="mq-note">
          <p className="mq-note__eyebrow">Today's quest</p>
          <p className="mq-note__title">{quest.title}</p>
          <p className="mq-note__meta">{quest.xp} · {quest.time}</p>
        </div>
      </div>
      <p className="mq-count">
        {recs.length ? `${done} of ${recs.length} missions done` : "No missions from your plan right now"}
      </p>
    </div>
  );

  const bottom = (
    <div className="gw-panel">
      <TextBox key={text} text={text} font="read" instant={instant} />
      <div className="dx-actions">
        {rec ? (
          <>
            <button type="button" className={`gs-btn${p.missions[rec.id]?.done ? "" : " gs-btn--primary"}`} onClick={toggle}>
              {p.missions[rec.id]?.done ? "Undo" : <><CheckOutlined aria-hidden /> I did this</>}
            </button>
            <button type="button" className="gs-btn" onClick={() => go(rec.page)}>Show me how</button>
          </>
        ) : quest.action.to ? (
          <Link className="gs-btn gs-btn--primary" to={quest.action.to}>{quest.action.label}</Link>
        ) : (
          <button type="button" className="gs-btn gs-btn--primary" onClick={questAction}>{quest.action.label}</button>
        )}
      </div>
      <p className="dx-note" role="status">{cheer}</p>
      {guest && (
        <p className="gw-start-note">
          You're not signed in, so missions are saved in this browser only. <Link to="/signup">Create a free account</Link> to keep your progress anywhere.
        </p>
      )}
      <ListMenu
        label="Missions"
        columns={2}
        autoFocus={false}
        className="gw-goto"
        items={[
          { key: "today", label: "Today's quest", sub: quest.title },
          ...recs.map((r) => ({ key: r.id, label: r.title, sub: p.missions[r.id]?.done ? "Done" : `+${XP.mission} XP · honor system` })),
        ]}
        onSelect={(k) => {
          setPick(k);
          setCheer("");
        }}
      />
    </div>
  );

  return (
    <HandheldFrame
      topLabel="Quest board"
      bottomLabel="Missions"
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
