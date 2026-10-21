import { useEffect, useMemo, useRef, useState } from "react";
import { HomeOutlined } from "@ant-design/icons";
import { Slider, duration, money, pct, prefersReducedMotion } from "../design";
import { useGame } from "../game/store";
import { HIGH_INTEREST_APR } from "../dashboard/finance";
import { debtOutlook, encounterOrder, healthFraction, minimumsOnly, newlyCleared, sproutHint } from "../game/debtBattle";
import { debtBlobArt } from "../battle/debtBlobArt";
import { HandheldFrame } from "./HandheldFrame";
import { TextBox } from "./TextBox";
import { ListMenu } from "./ListMenu";
import { PixelArt } from "./PixelArt";
import { SPROUT_BATTLE, SPROUT_PALETTE } from "./sprites";
import { ClassicViewButton } from "./GardenWorld";
import "../battle/battle.css";
import "./debt.css";

const STRATEGY = { avalanche: "Highest interest first", snowball: "Smallest balance first" };
const ASSUME = "Assumes today's balances, rates and minimums stay the same.";

/**
 * The debt battle: one Debt Blob per debt, in the order the plan pays them. A Blob's health is the
 * months until that debt is gone on the plan shown; "damage" is months a what-if saves. The real
 * balance never changes here. Pay Extra and Pick Strategy are what-ifs until "Save this to my plan".
 * A real victory only comes when the survey shows a debt it once had at $0.
 */
export default function DebtScene({ profile, metrics, plan, setPlan, go, query }) {
  const game = useGame();
  const reduced = Boolean(prefersReducedMotion());
  const instant = Boolean(game?.progress.settings.instantText) || reduced;
  const returnTo = query?.get("return") || "garden?from=toolshed";

  // What-if, plan-wide (extra money rolls from one debt to the next), forgotten on leaving.
  const [extra, setExtra] = useState(plan.extraDebt);
  const [strategy, setStrategy] = useState(plan.strategy);
  const trying = extra !== plan.extraDebt || strategy !== plan.strategy;

  const debts = profile.debts;
  const order = useMemo(() => encounterOrder(debts, strategy), [debts, strategy]);
  const saved = useMemo(() => debtOutlook(debts, { extra: plan.extraDebt, strategy: plan.strategy }), [debts, plan.extraDebt, plan.strategy]);
  const shown = useMemo(() => (trying ? debtOutlook(debts, { extra, strategy }) : saved), [trying, debts, extra, strategy, saved]);
  const mins = useMemo(() => minimumsOnly(debts), [debts]);

  // Real victories first: debts the survey once showed and now shows at $0.
  const [victories, setVictories] = useState(() => (game?.ready ? newlyCleared(game.progress, profile) : []));
  const noted = useRef(false);
  useEffect(() => {
    if (!game?.ready || noted.current) return;
    noted.current = true;
    if (profile.fromSurvey) game.dispatch({ type: "noteDebts", names: debts.filter((d) => d.balance > 0).map((d) => d.name) });
  }, [game, profile.fromSurvey, debts]);

  const [name, setName] = useState(() => {
    const wanted = query?.get("debt");
    return order.find((d) => d.name === wanted)?.name ?? order[0]?.name ?? null;
  });
  const debt = order.find((d) => d.name === name) ?? order[0];
  const index = debt ? debts.findIndex((d) => d.name === debt.name) : 0;
  const [panel, setPanel] = useState("menu"); // menu | extra | strategy | end
  const [text, setText] = useState(() =>
    debt ? `A Debt Blob blocks the path: ${debt.name}! Its health is the months until it's gone on your plan. Your real balance stays as it is here.` : ""
  );
  const [status, setStatus] = useState("");

  // A hit when a what-if takes months off this debt (shown once the slider settles).
  const months = debt ? shown.byName[debt.name]?.months : null;
  const [hit, setHit] = useState(0);
  const last = useRef(months);
  useEffect(() => {
    const t = setTimeout(() => {
      if (months != null && last.current != null && months < last.current && !reduced) setHit((n) => n + 1);
      last.current = months;
    }, 350);
    return () => clearTimeout(t);
  }, [months, reduced]);
  const [posing, setPosing] = useState(false);
  useEffect(() => {
    if (!hit) return undefined;
    setPosing(true);
    const t = setTimeout(() => setPosing(false), 520);
    return () => clearTimeout(t);
  }, [hit]);

  const goneBy = (o) => (o?.date ? o.date : "not yet: interest outpaces the payments");
  const planWords = trying ? `if you paid ${money(extra)} extra, ${STRATEGY[strategy].toLowerCase()} (a what-if, not saved)` : "on your saved plan";

  // ---------- Victory (real $0) ----------
  if (victories.length) {
    const won = victories[0];
    const art = debtBlobArt(0, { state: "calm" });
    const next = () => {
      game.dispatch({ type: "debtCleared", name: won });
      setVictories((v) => v.slice(1));
    };
    return (
      <HandheldFrame
        topLabel="Debt paid off"
        bottomLabel="Victory"
        top={
          <div className="bt-scene is-befriended db-victory">
            <div className="bt-sky" aria-hidden />
            <div className="bt-field" aria-hidden />
            <div className="bt-pad bt-pad--foe" aria-hidden />
            <div className="bt-foe" aria-hidden>
              <div className="bt-foe__body"><PixelArt rows={art.rows} palette={art.palette} size={128} /></div>
            </div>
            {!reduced && <div className="db-leaves" aria-hidden>{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ "--i": i }} />)}</div>}
            <div className="bt-plate bt-plate--foe"><span className="bt-plate__name">{won}: $0</span></div>
            <div className="bt-sprout" aria-hidden><div className="bt-sprout__body is-cheer"><PixelArt rows={SPROUT_BATTLE.idle} palette={SPROUT_PALETTE} size={96} /></div></div>
          </div>
        }
        bottom={
          <div className="gw-panel">
            <TextBox font="read" instant={instant} text={`Your survey shows your ${won} at $0. That Debt Blob is gone for good. Wonderful work, and it's real: it comes from your own numbers.`} />
            <ListMenu label="Victory" items={[{ key: "next", label: "Continue" }]} onSelect={next} />
          </div>
        }
        toolbar={<ClassicViewButton go={go} />}
      />
    );
  }

  // ---------- No debts ----------
  if (!debt) {
    return (
      <HandheldFrame
        topLabel="Toolshed"
        bottomLabel="Debt battle"
        top={<div className="bt-scene"><div className="bt-sky" aria-hidden /><div className="bt-field" aria-hidden /><div className="bt-sprout" aria-hidden><div className="bt-sprout__body is-cheer"><PixelArt rows={SPROUT_BATTLE.idle} palette={SPROUT_PALETTE} size={96} /></div></div></div>}
        bottom={
          <div className="gw-panel">
            <TextBox instant={instant} text="No Debt Blobs here. You don't have any debt to pay off, which leaves lots of room to grow." />
            <ListMenu label="Debt battle" items={[{ key: "back", label: "Back" }]} onSelect={() => go(returnTo)} />
          </div>
        }
        toolbar={<ClassicViewButton go={go} />}
      />
    );
  }

  const savedHere = saved.byName[debt.name];
  const shownHere = shown.byName[debt.name];
  const minHere = mins[debt.name];
  const hp = healthFraction(shownHere?.months, minHere?.months, savedHere?.months);
  const pos = order.findIndex((d) => d.name === debt.name);
  const nextDebt = order[pos + 1];
  const art = debtBlobArt(index, { thorny: debt.apr >= HIGH_INTEREST_APR, state: posing ? "hit" : "idle" });

  const numbers = () =>
    `${debt.name}: balance ${money(debt.balance)} at ${pct(debt.apr, 1)} APR, minimum ${money(debt.minPayment)} a month ` +
    `(about ${money((debt.balance * debt.apr) / 12)} of interest this month). ` +
    `On your saved plan (${money(plan.extraDebt)} extra, ${STRATEGY[plan.strategy].toLowerCase()}): gone by ${goneBy(savedHere)}. ` +
    `${trying ? `What-if (not saved): gone by ${goneBy(shownHere)}. ` : ""}` +
    `Paying only its minimum: ${goneBy(minHere)}. ${ASSUME}`;

  const onCommand = (k) => {
    setStatus("");
    if (k === "extra") return setPanel("extra");
    if (k === "strategy") return setPanel("strategy");
    if (k === "sprout") return setText(sproutHint(debt, { m: metrics, plan: { extraDebt: extra, strategy }, order }));
    if (k === "numbers") return setText(numbers());
    if (k === "next") {
      setText(`Plan set: ${debt.name} gone by ${goneBy(shownHere)} ${planWords}. Next up: ${nextDebt.name}!`);
      return setName(nextDebt.name);
    }
    return setPanel("end");
  };

  const result = trying
    ? `What-if, not saved: ${debt.name} gone by ${goneBy(shownHere)}${savedHere?.months != null && shownHere?.months != null ? `, ${shownHere.months < savedHere.months ? `${duration(savedHere.months - shownHere.months)} sooner than` : shownHere.months > savedHere.months ? `${duration(shownHere.months - savedHere.months)} later than` : "the same as"} your saved plan (${savedHere.date})` : ""}.`
    : `This is your saved plan: ${debt.name} gone by ${goneBy(savedHere)}.`;
  const save = () => {
    setPlan({ extraDebt: extra, strategy });
    setStatus(`Saved. Your plan now pays ${money(extra)} extra a month, ${STRATEGY[strategy].toLowerCase()}. The Classic Debt page and your garden show the same dates.`);
  };
  const reset = () => {
    setExtra(plan.extraDebt);
    setStrategy(plan.strategy);
  };

  let bottom;
  if (panel === "extra") {
    bottom = (
      <div className="gw-panel">
        <Slider label={`What if you paid ${money(extra)} extra?`} value={extra} min={0} max={1500} step={25} format={money} hint="a month, across all debts" onChange={setExtra} />
        {trying && <p className="gs-whatif__tag">What-if · not saved</p>}
        <p className="gs-whatif__result" aria-live="polite">{result}</p>
        <p className="gs-clock__note">Only plan extra you can keep paying after bills and minimums, with a small emergency cushion. {ASSUME}</p>
        <div className="gs-whatif__actions">
          {trying && <button type="button" className="gs-btn gs-btn--primary" onClick={save}>Save this to my plan</button>}
          {trying && <button type="button" className="gs-btn" onClick={reset}>Back to my saved plan</button>}
          <button type="button" className="gs-btn" onClick={() => setPanel("menu")}>Done</button>
        </div>
        <p className="gs-whatif__status" role="status">{status}</p>
      </div>
    );
  } else if (panel === "strategy") {
    const both = ["avalanche", "snowball"].map((st) => ({ st, o: debtOutlook(debts, { extra, strategy: st }) }));
    bottom = (
      <div className="gw-panel">
        <TextBox
          font="read"
          instant
          text={`Both work. Highest interest first saves the most money. Smallest balance first clears a whole debt sooner, which can feel great. With ${money(extra)} extra a month: ${both
            .map(({ st, o }) => `${STRATEGY[st].toLowerCase()} is debt-free by ${o.date ?? "not yet"} with ${money(o.interest)} interest`)
            .join("; ")}.`}
        />
        <ListMenu
          label="Pick a strategy"
          items={[
            ...both.map(({ st, o }) => ({ key: st, label: `${STRATEGY[st]}${st === strategy ? " (chosen)" : ""}`, sub: `Debt-free by ${o.date ?? "not yet"} · ${money(o.interest)} interest` })),
            { key: "done", label: "Done" },
          ]}
          onSelect={(k) => (k === "done" ? setPanel("menu") : setStrategy(k))}
          onBack={() => setPanel("menu")}
        />
        {trying && (
          <div className="gs-whatif__actions">
            <p className="gs-whatif__tag">What-if · not saved</p>
            <button type="button" className="gs-btn gs-btn--primary" onClick={save}>Save this to my plan</button>
            <button type="button" className="gs-btn" onClick={reset}>Back to my saved plan</button>
          </div>
        )}
        <p className="gs-whatif__status" role="status">{status}</p>
      </div>
    );
  } else if (panel === "end") {
    bottom = (
      <div className="gw-panel">
        <TextBox
          font="read"
          instant={instant}
          text={`Plan set! On your saved plan (${money(plan.extraDebt)} extra a month, ${STRATEGY[plan.strategy].toLowerCase()}): ${encounterOrder(debts, plan.strategy)
            .map((d) => `${d.name} gone by ${goneBy(saved.byName[d.name])}`)
            .join("; ")}. Debt-free by ${saved.date ?? "not yet"}.${trying ? " Your what-if wasn't saved, so the plan is unchanged." : ""} These are projections; the Blobs only leave for good when your survey shows $0.`}
        />
        <ListMenu label="Debt battle done" items={[{ key: "again", label: "Back to the battle" }, { key: "leave", label: "Leave" }]} onSelect={(k) => (k === "leave" ? go(returnTo) : setPanel("menu"))} />
      </div>
    );
  } else {
    bottom = (
      <div className="gw-panel">
        <TextBox key={text} text={text} font="read" instant={instant} />
        <ListMenu
          label="Debt battle commands"
          columns={2}
          className="gw-goto"
          items={[
            { key: "extra", label: "Pay Extra", sub: trying ? `${money(extra)} · what-if` : `${money(plan.extraDebt)} · saved plan` },
            { key: "strategy", label: "Pick Strategy", sub: STRATEGY[strategy] },
            { key: "sprout", label: "Ask Sprout", sub: "A friendly hint" },
            { key: "numbers", label: "Show Numbers", sub: "Balance, APR, dates" },
            ...(nextDebt ? [{ key: "next", label: "Next debt", sub: nextDebt.name }] : []),
            { key: "leave", label: "Finish", sub: "See your whole plan" },
          ]}
          onSelect={onCommand}
        />
        <p className="bt-note">Debt {pos + 1} of {order.length}. Moving the slider never earns XP: the game rewards habits, not dollar amounts.</p>
      </div>
    );
  }

  const top = (
    <div className="bt-scene">
      <div className="bt-sky" aria-hidden />
      <div className="bt-field" aria-hidden />
      <div className="bt-plate bt-plate--foe">
        <div className="bt-plate__row">
          <span className="bt-plate__name">{debt.name}</span>
          <span className="bt-plate__lv">{pct(debt.apr, 1)} APR{debt.apr >= HIGH_INTEREST_APR ? " · high" : ""}</span>
        </div>
        <div className="bt-bar">
          <span className="bt-bar__label">Months</span>
          <span className="bt-bar__track"><span className="bt-bar__fill" style={{ width: `${hp * 100}%` }} /></span>
        </div>
        <span className="bt-plate__num">
          {shownHere?.months != null ? `Gone by ${shownHere.date} · ${duration(shownHere.months)}` : "Not gone yet at this pace"}
          {trying ? " (what-if)" : ""}
        </span>
      </div>
      <div className="bt-pad bt-pad--foe" aria-hidden />
      <div className="bt-foe" aria-hidden>
        <div key={`blob-${hit}`} className={`bt-foe__body${posing ? " fx-hit" : ""}`}>
          <PixelArt rows={art.rows} palette={art.palette} size={128} />
        </div>
      </div>
      <div className="bt-pad bt-pad--sprout" aria-hidden />
      <div className="bt-sprout" aria-hidden>
        <div className="bt-sprout__body"><PixelArt rows={SPROUT_BATTLE[posing ? "step" : "idle"]} palette={SPROUT_PALETTE} size={96} /></div>
      </div>
      <div className="bt-plate bt-plate--sprout">
        <div className="bt-plate__row">
          <span className="bt-plate__name">Balance</span>
          <span className="bt-plate__lv">today</span>
        </div>
        <span className="bt-plate__num">{money(debt.balance)} · min {money(debt.minPayment)}</span>
      </div>
    </div>
  );

  return (
    <HandheldFrame
      topLabel={`Debt battle: ${debt.name}`}
      bottomLabel="Debt battle controls"
      top={top}
      bottom={bottom}
      toolbar={
        <>
          <button type="button" className="hh-btn" onClick={() => go(returnTo)}>
            <HomeOutlined aria-hidden /> Leave
          </button>
          <ClassicViewButton go={go} />
        </>
      }
    />
  );
}
