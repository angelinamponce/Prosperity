import { memo, useMemo, useState } from "react";
import { CheckOutlined, HomeOutlined } from "@ant-design/icons";
import { prefersReducedMotion } from "../design";
import { useGame } from "../game/store";
import { DEX, dexNumbers } from "../game/dex";
import { gradeBreakdown } from "../dashboard/finance";
import { GLOSSARY } from "../dashboard/glossary";
import { FOES } from "../battle/foes";
import { FoeSprite } from "../battle/sprites";
import { TOPICS } from "../quiz/topics";
import { HandheldFrame } from "./HandheldFrame";
import { TextBox } from "./TextBox";
import { ListMenu } from "./ListMenu";
import { PixelArt } from "./PixelArt";
import { ClassicViewButton } from "./GardenWorld";
import { DEX_ART, DEX_PALETTE, SEED_PACKET } from "./dexArt";
import "./dex.css";

const EntryList = memo(ListMenu);
const NONE = {};

/**
 * The Garden Dex, inside the Library: a plant for every money word and a page for every Misconception
 * you've befriended. Nothing is hidden: unlearned words still show their definition and numbers; they
 * just haven't been planted yet. Learning happens the same ways as everywhere else (reading a word,
 * or getting a quiz question about it right).
 */
export default function DexScene({ profile, metrics, plan, go }) {
  const game = useGame();
  const instant = Boolean(game?.progress.settings.instantText) || Boolean(prefersReducedMotion());
  const terms = game?.ready ? game.progress.terms : NONE;
  const befriended = game?.ready ? game.progress.quiz.befriended : NONE;
  const [tab, setTab] = useState("plants");
  const [plantKey, setPlantKey] = useState(() => DEX.find((d) => terms[d.key])?.key ?? DEX[0].key);
  const [foeId, setFoeId] = useState(() => FOES.find((f) => befriended[f.id])?.id ?? FOES[0].id);
  const [showNumbers, setShowNumbers] = useState(false);
  const [justPlanted, setJustPlanted] = useState(null);
  const grade = useMemo(() => gradeBreakdown(metrics), [metrics]);

  const planted = DEX.filter((d) => terms[d.key]).length;
  const friends = FOES.filter((f) => befriended[f.id]).length;

  const entry = DEX.find((d) => d.key === plantKey);
  const word = GLOSSARY[plantKey];
  const learned = Boolean(terms[plantKey]);
  const foe = FOES.find((f) => f.id === foeId);
  const met = befriended[foeId];

  let text;
  if (tab === "plants") {
    if (showNumbers) {
      const n = dexNumbers(plantKey, { profile, m: metrics, plan, grade });
      text = `${word.title}, with your numbers: ${n.text}${n.assumption ? ` ${n.assumption}` : ""}${profile.fromSurvey ? "" : " (These are sample numbers.)"}`;
    } else {
      text = `${word.title}: ${word.explain}${learned ? ` ${entry.species}: ${entry.why}` : ""}`;
    }
  } else {
    text = met
      ? `${foe.name} used to believe: “${foe.myth}” The truth: ${foe.truth}`
      : `${foe.name} hasn't been befriended yet. It believes: “${foe.myth}” Find it in the ${TOPICS[foe.topic].label} Greenhouse or the tall grass.`;
  }

  const pickPlant = (k) => {
    setPlantKey(k);
    setShowNumbers(false);
    setJustPlanted(null);
  };
  const plant = () => {
    game?.learnTerm(plantKey, word.title);
    setJustPlanted(plantKey);
  };

  const plantItems = useMemo(
    () => DEX.map((d) => ({ key: d.key, label: GLOSSARY[d.key].title, sub: terms[d.key] ? d.species : "Seed packet · not planted yet" })),
    [terms]
  );
  const foeItems = useMemo(
    () => FOES.map((f) => ({ key: f.id, label: f.name, sub: `${TOPICS[f.topic].label} · ${befriended[f.id] ? "befriended" : "not befriended yet"}` })),
    [befriended]
  );

  const top = (
    <div className="dx-view">
      <div className="dx-stage" aria-hidden>
        {tab === "plants" ? (
          <PixelArt rows={learned ? DEX_ART[plantKey] : SEED_PACKET} palette={DEX_PALETTE} size={144} />
        ) : (
          <div className={met ? undefined : "dx-unmet"}>
            <FoeSprite foe={foe} size={144} state={met ? "happy" : "idle"} />
          </div>
        )}
      </div>
      <div className="dx-plate">
        {tab === "plants" ? (
          <>
            <p className="dx-plate__name">{learned ? entry.species : word.title}</p>
            <p className="dx-plate__sub">
              {learned ? <>{word.title} · <CheckOutlined aria-hidden /> Planted</> : "Seed packet · not planted yet"}
            </p>
          </>
        ) : (
          <>
            <p className="dx-plate__name">{foe.name}</p>
            <p className="dx-plate__sub">
              {TOPICS[foe.topic].label} · {met ? <><CheckOutlined aria-hidden /> Befriended{met.times > 1 ? ` ${met.times} times` : ""}</> : "Not befriended yet"}
            </p>
          </>
        )}
      </div>
    </div>
  );

  const bottom = (
    <div className="gw-panel">
      <TextBox key={text} text={text} font="read" instant={instant} />
      <div className="dx-actions">
        {tab === "plants" ? (
          <>
            <button type="button" className="gs-btn" aria-pressed={showNumbers} onClick={() => setShowNumbers((v) => !v)}>
              {showNumbers ? "Show the meaning" : "Show me with my numbers"}
            </button>
            {!learned && (
              <button type="button" className="gs-btn gs-btn--primary" onClick={plant}>
                I've read this: plant it
              </button>
            )}
            {justPlanted === plantKey && learned && <p className="dx-note" role="status">Planted! New word learned · +10 XP</p>}
          </>
        ) : (
          !met && (
            <button type="button" className="gs-btn" onClick={() => go(`battle?topic=${foe.topic}&from=garden`)}>
              Practice in the {TOPICS[foe.topic].label} Greenhouse
            </button>
          )
        )}
      </div>
      <div className="dx-tabs" role="group" aria-label="Garden Dex pages">
        <button type="button" className="gs-btn" aria-pressed={tab === "plants"} onClick={() => setTab("plants")}>
          Plants · {planted} of {DEX.length}
        </button>
        <button type="button" className="gs-btn" aria-pressed={tab === "friends"} onClick={() => setTab("friends")}>
          Befriended · {friends} of {FOES.length}
        </button>
      </div>
      {tab === "plants" ? (
        <EntryList key="plants" label="Money word plants" items={plantItems} columns={2} onSelect={pickPlant} autoFocus={false} className="gw-goto" />
      ) : (
        <EntryList key="friends" label="Misconceptions" items={foeItems} columns={2} onSelect={setFoeId} autoFocus={false} className="gw-goto" />
      )}
    </div>
  );

  return (
    <HandheldFrame
      topLabel="Garden Dex"
      bottomLabel="Garden Dex pages"
      top={top}
      bottom={bottom}
      toolbar={
        <>
          <button type="button" className="hh-btn" onClick={() => go("garden?from=library")}>
            <HomeOutlined aria-hidden /> Back to town
          </button>
          <ClassicViewButton go={go} />
        </>
      }
    />
  );
}
