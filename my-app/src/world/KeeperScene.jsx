import { useState } from "react";
import { CheckOutlined, HomeOutlined } from "@ant-design/icons";
import { StageIcon, prefersReducedMotion } from "../design";
import { useGame } from "../game/store";
import { KEEPER } from "../game/rules";
import { KEEPERS, keeperStatus } from "../game/keepers";
import { keeperArt } from "../battle/keeperArt";
import { TOPICS } from "../quiz/topics";
import { HandheldFrame } from "./HandheldFrame";
import { TextBox } from "./TextBox";
import { ListMenu } from "./ListMenu";
import { PixelArt } from "./PixelArt";
import { ClassicViewButton } from "./GardenWorld";
import "./keeper.css";

/**
 * Inside a Greenhouse: its keeper teaches a few plain lines (tap through, or skip straight to the menu),
 * then offers the keeper challenge, quick practice, or the way out. The menu is always there.
 */
export default function KeeperScene({ go, query }) {
  const game = useGame();
  const topic = TOPICS[query?.get("topic")] ? query.get("topic") : "budgeting";
  const keeper = KEEPERS[topic];
  const label = TOPICS[topic].label;
  const instant = Boolean(game?.progress.settings.instantText) || Boolean(prefersReducedMotion());
  const status = game?.ready ? keeperStatus(game.progress, topic) : { best: 0, tries: 0, passed: false };
  const [line, setLine] = useState(0);
  const art = keeperArt(topic);
  const back = `garden?from=${keeper.greenhouse}`;

  const last = line >= keeper.teach.length - 1;
  const statusText = status.passed
    ? `${label} Badge earned. Best: ${status.best} of ${KEEPER.questions}.`
    : status.tries
      ? `Best so far: ${status.best} of ${KEEPER.questions}. ${KEEPER.pass} earns the badge.`
      : `${KEEPER.pass} of ${KEEPER.questions} right on the first try earns the ${label} Badge.`;

  const onSelect = (key) => {
    if (key === "challenge") go(`battle?topic=${topic}&keeper=1&from=garden&back=${keeper.greenhouse}`);
    else if (key === "practice") go(`battle?topic=${topic}&from=garden&back=${keeper.greenhouse}`);
    else go(back);
  };

  const top = (
    <div className="kp-view">
      <div className="kp-glass" aria-hidden />
      <div className="kp-keeper" aria-hidden>
        <PixelArt rows={art.rows} palette={art.palette} size={200} />
      </div>
      <div className="kp-plate">
        <p className="kp-plate__name">{keeper.name}</p>
        <p className="kp-plate__sub">
          {label} Greenhouse ·{" "}
          {status.passed ? (
            <>
              <CheckOutlined aria-hidden /> Badge earned
            </>
          ) : (
            "Badge not earned yet"
          )}
        </p>
      </div>
      {status.passed && (
        <span className="kp-badge">
          <StageIcon stage={`gh-${topic}`} size={44} label={`${label} Badge`} />
        </span>
      )}
    </div>
  );

  const bottom = (
    <div className="gw-panel">
      <TextBox
        key={line}
        text={keeper.teach[line]}
        speaker={keeper.name}
        instant={instant}
        waiting={!last}
        onContinue={() => setLine((n) => Math.min(keeper.teach.length - 1, n + 1))}
      />
      <p className="kp-status">{statusText}</p>
      <ListMenu
        label={`${keeper.name}'s menu`}
        columns={1}
        autoFocus={false}
        className="gw-goto"
        items={[
          { key: "challenge", label: "Keeper challenge", sub: `${KEEPER.questions} questions · ${status.passed ? "badge earned, play again any time" : "earn the badge"}` },
          { key: "practice", label: "Quick practice", sub: "3 questions · no badge on the line" },
          { key: "leave", label: "Leave", sub: "Back to town" },
        ]}
        onSelect={onSelect}
      />
    </div>
  );

  return (
    <HandheldFrame
      topLabel={`${label} Greenhouse`}
      bottomLabel={`${keeper.name}`}
      top={top}
      bottom={bottom}
      toolbar={
        <>
          <button type="button" className="hh-btn" onClick={() => go(back)}>
            <HomeOutlined aria-hidden /> Back to town
          </button>
          <ClassicViewButton go={go} />
        </>
      }
    />
  );
}
