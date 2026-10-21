import { memo, useEffect, useMemo, useState } from "react";
import { EnvironmentOutlined, HomeOutlined } from "@ant-design/icons";
import { Slider, duration, money, pct, prefersReducedMotion } from "../design";
import { useGame } from "../game/store";
import { deriveGarden, lapseFrame, payoffLookahead, DEBT_PER_WEED, LOOKAHEAD_MONTHS, MAX_WEEDS_PER_DEBT } from "../game/garden";
import { gradeBreakdown, HIGH_INTEREST_APR } from "../dashboard/finance";
import { GLOSSARY } from "../dashboard/glossary";
import { HandheldFrame } from "./HandheldFrame";
import { TextBox } from "./TextBox";
import { ListMenu } from "./ListMenu";
import { TILE } from "./town";
import { DIRS } from "./movement";
import { useWalker } from "./useWalker";
import { WalkControls } from "./DPad";
import { WorldMap, useBox, useStable } from "./WorldMap";
import { ClassicViewButton } from "./GardenWorld";
import { StartButton, StartMenu, useStartMenu } from "./StartMenu";
import { Almanac } from "./Almanac";
import { sfx } from "./sound";
import { BEDS, BORDER, GARDEN, GARDEN_SPAWN, GATE, GREENHOUSE, SIGN, VISITOR_SPOT, elementAt, layoutGarden } from "./gardenMap";
import { ART, GreenhouseArt, Tile } from "./gardenArt";
import { SKIES, forecast, forecastText } from "../game/weather";
import "./weather.css";

const GuideList = memo(ListMenu);
const WORD_TOTAL = Object.keys(GLOSSARY).length;
const STRATEGY = { avalanche: "highest interest first", snowball: "smallest balance first" };

const at = (x, y, w = 1, h = 1, z = y + h) => ({ left: x * TILE, top: y * TILE, width: w * TILE, height: h * TILE, zIndex: z * 10 });
const inRect = (r, x, y) => x >= r.x && x < r.x + (r.w ?? 1) && y >= r.y && y < r.y + (r.h ?? 1);

const ASSUME = "Assumes today's balances, rates and minimums stay the same.";

/** Which plan a date comes from, in words. Every date in the garden names one of these. */
const planWords = (wi) => (wi.trying ? `if you paid ${money(wi.extra)} extra (a what-if, not saved)` : "on your saved plan");

/**
 * "Show the numbers" for one element, or for one debt's weed patches. Dates always come from the saved
 * plan first; while a what-if is being tried, its date follows, labeled as not saved.
 */
function numbersFor(garden, plan, wi, key) {
  const [id, debt] = key.split(":");
  if (id === "weeds" && debt != null) {
    const i = Number(debt);
    const w = garden.byId.weeds.weeds[i];
    const shown = wi.shown.debts[i];
    const soon = shown.patchMonths.filter((m) => m != null && m <= LOOKAHEAD_MONTHS).length;
    const whatIf = wi.trying
      ? ` What if you paid ${money(wi.extra)} extra (not saved): ${shown.payoffDate ? `cleared by ${shown.payoffDate}` : "still no cleared date"}.`
      : "";
    const placed = wi.placed[i] ?? 0;
    const fit =
      placed >= w.patches ? "" : placed === 0 ? " The beds are already full of other debts' patches, so these are counted here instead of drawn." : ` The beds hold ${placed} of them; the rest are counted here instead of drawn.`;
    const outlined = soon ? ` ${soon} of ${w.patches} ${soon === 1 ? "patch is" : "patches are"} outlined: cleared within ${LOOKAHEAD_MONTHS} months ${planWords(wi)}.` : "";
    const kind = w.thorny ? "thorny bramble" : "weed";
    const cleared = w.payoffDate
      ? `On your saved plan (${money(plan.extraDebt)} extra a month, ${STRATEGY[plan.strategy] ?? plan.strategy}), it's cleared by ${w.payoffDate}.`
      : "On your saved plan, the minimum payment doesn't catch up with the interest yet, so there's no cleared date.";
    return (
      `${w.name}: ${w.patches} ${kind} ${w.patches === 1 ? "patch" : "patches"}. ` +
      `Balance ${money(w.balance)} at ${pct(w.apr, 1)} APR, minimum ${money(w.minPayment)} a month. ` +
      `One patch for every ${money(DEBT_PER_WEED)} owed, up to ${MAX_WEEDS_PER_DEBT}${w.thorny ? `; debts at ${pct(HIGH_INTEREST_APR)} APR or more grow brambles` : ""}. ${cleared}${whatIf}${outlined}${fit} ${ASSUME}`
    );
  }
  if (id === "weather") {
    const f = wi.weather;
    if (f.none) return forecastText(f);
    return `Forecast: ${SKIES[f.sky].label.toLowerCase()} is most common. ${forecastText(f)} It's weather, not a score: a storm may droop a few plants for a moment, but nothing in your garden is ever lost. Visit the Weather Station in town for what could brighten it.`;
  }
  const e = garden.byId[id];
  const base = `${e.label}. ${e.title}: ${e.value}. ${e.calc}`;
  if (id === "season" && wi.trying && e.state !== "harvest") {
    return `${base} What if you paid ${money(wi.extra)} extra (not saved): ${wi.shown.date ?? "no debt-free date yet"}. ${ASSUME}`;
  }
  return base;
}

/** Everything growing in the garden, as buttons over the ground. Memoized: walking doesn't re-render it. */
const Plants = memo(function Plants({ garden, layout, ghosts, ghostNote, reduced, droop, frame, onShow }) {
  const g = garden.byId;
  const click = (key, tile) => (e) => {
    e.stopPropagation();
    onShow(key, e.detail === 0 ? null : tile);
  };
  const soilButton = layout.crops[0] ?? { x: BEDS[2].x, y: BEDS[2].y };
  return (
    <>
      {/* Crops on every bed tile that isn't weeds; their size follows the soil. */}
      {layout.crops.map((c) => (
        <span key={`c${c.x}-${c.y}`} className={`gs-tile${droop && (c.x + c.y) % 3 === 0 ? " gs-droop" : ""}`} style={at(c.x, c.y)} onClick={click("soil", c)} aria-hidden>
          <Tile rows={ART.CROPS[c.tier]} />
        </span>
      ))}
      <button type="button" className="gs-hit" style={at(soilButton.x, soilButton.y)} aria-label={`Vegetable beds: ${g.soil.label}. Show the numbers.`} onClick={click("soil", soilButton)} />

      {/* Weeds: one group per debt. Only each group's first patch is a tab stop, so Tab doesn't wade through all of them. */}
      {/* Patches a plan would clear within the year stay in place, outlined with a flag: never removed as if paid. */}
      {layout.weeds.map((w) => {
        const d = g.weeds.weeds[w.debt];
        // In the fast-forward, a patch past its projected month becomes a fresh seedling.
        if (frame?.cleared.has(`${w.debt}-${w.k}`)) {
          return w.first ? (
            <button
              key={`w${w.x}-${w.y}`}
              type="button"
              className="gs-tile gs-hit gs-new"
              style={at(w.x, w.y)}
              aria-label={`${d.name}: cleared by ${frame.date} in this projection. Show the numbers.`}
              onClick={click(`weeds:${w.debt}`, w)}
            >
              <Tile rows={ART.SEEDLING} />
            </button>
          ) : (
            <span key={`w${w.x}-${w.y}`} className="gs-tile gs-new" style={at(w.x, w.y)} onClick={click(`weeds:${w.debt}`, w)} aria-hidden>
              <Tile rows={ART.SEEDLING} />
            </span>
          );
        }
        const ghost = !frame && ghosts.has(`${w.x}-${w.y}`);
        const art = (
          <>
            <Tile rows={w.thorny ? ART.BRAMBLE : ART.WEED} />
            {ghost && <span className="gs-flag"><Tile rows={ART.FLAG} /></span>}
          </>
        );
        const cls = `gs-tile${ghost ? " gs-ghost" : ""}`;
        if (!w.first) {
          return (
            <span key={`w${w.x}-${w.y}`} className={cls} style={at(w.x, w.y)} onClick={click(`weeds:${w.debt}`, w)} aria-hidden>
              {art}
            </span>
          );
        }
        const soon = layout.weeds.filter((o) => o.debt === w.debt && ghosts.has(`${o.x}-${o.y}`)).length;
        return (
          <button
            key={`w${w.x}-${w.y}`}
            type="button"
            className={`${cls} gs-hit`}
            style={at(w.x, w.y)}
            aria-label={
              `${d.name}: ${d.patches} ${w.thorny ? "thorny bramble" : "weed"} ${d.patches === 1 ? "patch" : "patches"}` +
              `${soon ? `, ${soon} outlined as cleared within a year ${ghostNote}` : ""}. Show the numbers.`
            }
            onClick={click(`weeds:${w.debt}`, w)}
          >
            {art}
          </button>
        );
      })}

      {/* The flower border: learned words bloom, the rest are seedlings, so it's never bare. */}
      <button type="button" className="gs-hit gs-group" style={at(BORDER.x, BORDER.y, BORDER.w, BORDER.h)} aria-label={`Flower border: ${g.flowers.label}. Show the numbers.`} onClick={click("flowers", BORDER)}>
        {layout.flowers.map((f) => (
          <span key={`f${f.x}-${f.y}`} className="gs-tile" style={at(f.x - BORDER.x, f.y - BORDER.y, 1, 1, 0)}>
            <Tile rows={f.bloom ? ART.FLOWERS[f.color] : ART.SEEDLING} />
          </span>
        ))}
      </button>

      {/* Visitors gather at the bird bath, which is always there waiting for them. */}
      <button type="button" className="gs-hit gs-group" style={at(VISITOR_SPOT.x, VISITOR_SPOT.y, VISITOR_SPOT.w, VISITOR_SPOT.h)} aria-label={`Bird bath: ${g.visitors.label}. Show the numbers.`} onClick={click("visitors", VISITOR_SPOT)}>
        <span className="gs-tile" style={at(1, 1, 1, 1, 0)}><Tile rows={ART.BIRDBATH} /></span>
        {/* Visitors drift around the bath; with reduced motion they sit still on their first frame. */}
        {g.visitors.visitors.includes("butterflies") && (
          <span className={`gs-tile${reduced ? "" : " gs-drift"}`} style={at(0, 0, 1, 1, 0)}>
            <span className={reduced ? undefined : "gs-flap"}>
              <Tile rows={ART.BUTTERFLY} />
              {!reduced && <Tile rows={ART.BUTTERFLY_UP} />}
            </span>
          </span>
        )}
        {g.visitors.visitors.includes("bees") && <span className={`gs-tile${reduced ? "" : " gs-drift gs-drift--bee"}`} style={at(3, 0, 1, 1, 0)}><Tile rows={ART.BEE} /></span>}
        {g.visitors.visitors.includes("a bird") && <span className="gs-tile" style={at(2, 1, 1, 1, 0)}><Tile rows={ART.BIRD} /></span>}
      </button>

      <button type="button" className="gs-hit gs-tall" style={{ ...at(GREENHOUSE.x, GREENHOUSE.y - 1, GREENHOUSE.w, GREENHOUSE.h + 1), zIndex: (GREENHOUSE.y + GREENHOUSE.h) * 10 }} aria-label={`Greenhouse: ${g.greenhouse.label}. Show the numbers.`} onClick={click("greenhouse", GREENHOUSE.door)}>
        <GreenhouseArt stage={frame ? frame.greenhouse.stage : g.greenhouse.state} />
      </button>

      <button type="button" className="gs-tile gs-hit" style={at(SIGN.x, SIGN.y)} aria-label={`Season sign: ${g.season.label}. Show the numbers.`} onClick={click("season", SIGN)}>
        <Tile rows={ART.SIGNPOST} />
      </button>

      {/* Decoration: a tended garden even before anything has grown. */}
      <span className="gs-tile" style={at(2, 2)} aria-hidden><Tile rows={ART.BENCH} /></span>
      <span className="gs-tile" style={at(6, 4)} aria-hidden><Tile rows={ART.CAN} /></span>
    </>
  );
});

/** A value that only catches up once it has stopped changing for `ms`. */
function useSettled(value, ms) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/**
 * The countdown to the debt-free date on the saved plan (a countdown, not a progress meter), and the
 * "What if you paid $X extra?" slider. The slider is a what-if: it outlines what that plan would clear and
 * shows its date beside the saved one, labeled as not saved. Only "Save this to my plan" changes the plan.
 */
function HarvestClock({ season, plan, wi, saved, onTry, onSave, onReset, status, onLapse }) {
  const harvest = season.state === "harvest";
  const ghostCount = wi.ghosts.size;
  const sooner = wi.trying && saved.months != null && wi.shown.months != null ? saved.months - wi.shown.months : 0;
  let result;
  if (!wi.trying) {
    result = `This is your saved plan. ${ghostCount ? `${ghostCount} outlined ${ghostCount === 1 ? "patch" : "patches"}: cleared within ${LOOKAHEAD_MONTHS} months.` : `No patch clears within ${LOOKAHEAD_MONTHS} months yet.`}`;
  } else {
    const when = wi.shown.date ? `debt-free by ${wi.shown.date}` : "no debt-free date yet";
    const vs = sooner > 0 ? `, ${duration(sooner)} sooner than` : sooner < 0 ? `, ${duration(-sooner)} later than` : ", the same as";
    result = `What-if, not saved: ${when}${wi.shown.date && saved.date ? `${vs} your saved plan (${saved.date})` : ""}. ${ghostCount} outlined ${ghostCount === 1 ? "patch" : "patches"}: cleared within ${LOOKAHEAD_MONTHS} months.`;
  }
  const settledResult = useSettled(result, 700);
  return (
    <section className="gs-clock" aria-labelledby="gs-clock-title">
      <div className="gs-clock__head">
        <h3 id="gs-clock-title" className="gw-panel__title">Time until Harvest Festival</h3>
        <p className="gs-clock__big">
          {harvest ? "Harvest Festival is here" : season.value === "Not yet" ? "Not set yet" : `${season.label.replace(/^Spring now, Harvest Festival in /, "")} · ${season.value}`}
        </p>
      </div>
      <div className="gs-clock__track" aria-hidden>
        <span>Today</span>
        <span className="gs-clock__line" />
        <span>{harvest ? "Now" : season.value}</span>
      </div>
      <p className="gs-clock__note">
        {harvest
          ? "No debt to clear, so it's harvest time already."
          : saved.date
            ? `Your debt-free date on your saved plan (${money(plan.extraDebt)} extra a month). A countdown, not a progress meter.`
            : `On your saved plan (${money(plan.extraDebt)} extra a month), payments don't catch up with the interest yet, so there's no Harvest Festival date. The slider below shows what would set one.`}
      </p>
      {!harvest && wi.shown.months != null && (
        <button type="button" className="gs-btn gs-lapse-go" onClick={onLapse}>
          ▶ Fast-forward to Harvest Festival
        </button>
      )}
      {!harvest && (
        <div className="gs-whatif">
          <Slider label={`What if you paid ${money(wi.extra)} extra?`} value={wi.extra} min={0} max={1500} step={25} format={money} hint="a month" onChange={onTry} />
          {wi.trying && <p className="gs-whatif__tag">What-if · not saved</p>}
          <p className="gs-whatif__result">{result}</p>
          {/* Read aloud once the slider settles, not at every $25 step (the slider itself reads its amount). */}
          <p className="ps-sr-only" aria-live="polite">{settledResult}</p>
          <p className="gs-clock__note">{ASSUME}</p>
          {wi.trying && (
            <div className="gs-whatif__actions">
              <button type="button" className="gs-btn gs-btn--primary" onClick={onSave}>Save this to my plan</button>
              <button type="button" className="gs-btn" onClick={onReset}>Back to my saved plan ({money(plan.extraDebt)})</button>
            </div>
          )}
          <p className="gs-whatif__status" role="status">{status}</p>
        </div>
      )}
    </section>
  );
}

/**
 * "Fast-forward to Harvest Festival": the plan shown, month by month, as a labeled projection. Play
 * steps a month at a time (no autoplay with reduced motion); the scrubber and its arrow keys move
 * freely; the text is read aloud once the scrubber settles.
 */
function LapsePanel({ frame, wi, plan, playing, reduced, onPlay, onSeek, onExit }) {
  const which = wi.trying ? `what-if: ${money(wi.extra)} extra a month, not saved` : `your saved plan: ${money(plan.extraDebt)} extra a month`;
  const debtsLine = frame.clearedDebts.length ? `Cleared so far: ${frame.clearedDebts.join(", ")}.` : "No debt cleared yet.";
  const text = frame.done
    ? `Harvest Festival, ${frame.date}! On ${which}, every weed is cleared and you're debt-free. The greenhouse: ${frame.greenhouse.label.toLowerCase()}. This is a projection: the real festival comes when your survey shows $0.`
    : `${frame.date}, ${frame.season.toLowerCase()} (month ${frame.t} of ${frame.total}). ${debtsLine} ${frame.patchesLeft} weed ${frame.patchesLeft === 1 ? "patch" : "patches"} left. Greenhouse: ${frame.greenhouse.label.toLowerCase()} (${frame.emergencyMonths.toFixed(1)} months of essentials).`;
  const settled = useSettled(playing ? "" : text, 600);
  return (
    <section className="gs-clock gs-lapse" aria-labelledby="gs-lapse-title">
      <div className="gs-clock__head">
        <h3 id="gs-lapse-title" className="gw-panel__title">Fast-forward to Harvest Festival</h3>
        <p className="gs-clock__big">{frame.done ? `Harvest Festival · ${frame.date}` : `${frame.season} · ${frame.date}`}</p>
      </div>
      <p className="gs-whatif__tag">Projection · {which}</p>
      <label className="gs-lapse__scrub">
        <span className="ps-sr-only">Month</span>
        <input
          type="range"
          min={0}
          max={frame.total}
          step={1}
          value={frame.t}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-valuetext={`${frame.date}, month ${frame.t} of ${frame.total}`}
        />
        <span className="gs-lapse__ends" aria-hidden><span>Today</span><span>{frame.done ? "Festival!" : `Festival · month ${frame.total}`}</span></span>
      </label>
      <p className="gs-whatif__result">{text}</p>
      <p className="ps-sr-only" aria-live="polite">{settled}</p>
      <p className="gs-clock__note">
        Assumes today's balances, rates and minimums hold, and {money(frame.emergencyMonthly)} a month into your emergency fund, as in your plan.
      </p>
      <div className="gs-whatif__actions">
        {!reduced && (
          <button type="button" className="gs-btn gs-btn--primary" aria-pressed={playing} onClick={onPlay}>
            {playing ? "❚❚ Pause" : frame.done ? "▶ Play again" : "▶ Play"}
          </button>
        )}
        {!frame.done && <button type="button" className="gs-btn" onClick={() => onSeek(frame.total)}>Jump to the festival</button>}
        <button type="button" className="gs-btn" onClick={onExit}>Back to today</button>
      </div>
    </section>
  );
}

/** The Garden scene: your plot up close, grown from your numbers. Walk out through the gate to go back to town. */
export default function GardenScene({ profile, metrics, plan, setPlan, go }) {
  const game = useGame();
  const [bottomRef, bottom] = useBox();
  const reduced = Boolean(prefersReducedMotion());
  const instant = Boolean(game?.progress.settings.instantText) || reduced;
  const learned = game?.ready ? Object.keys(game.progress.terms).length : 0;
  const healthScore = useMemo(() => gradeBreakdown(metrics).score, [metrics]);
  const garden = useMemo(
    () => deriveGarden({ profile, m: metrics, plan, healthScore, learned, wordTotal: WORD_TOTAL }),
    [profile, metrics, plan, healthScore, learned]
  );
  const layout = useMemo(() => layoutGarden(garden), [garden]);
  const start = useStartMenu();
  // The forecast from the same 500 futures as the Weather Station. A storm droops a few plants for a
  // moment when you arrive, then they stand back up; nothing is ever removed. Still with reduced motion.
  const weather = useMemo(() => forecast(profile, metrics, plan), [profile, metrics, plan]);
  const [droop, setDroop] = useState(!reduced && !weather.none && weather.sky === "stormy");
  useEffect(() => {
    if (!droop) return undefined;
    const t = setTimeout(() => setDroop(false), 4000);
    return () => clearTimeout(t);
  }, [droop]);

  // The what-if starts at the saved plan and is forgotten when you leave the garden.
  const [extra, setExtra] = useState(plan.extraDebt);
  const [status, setStatus] = useState("");
  const saved = useMemo(() => payoffLookahead(profile.debts, { extra: plan.extraDebt, strategy: plan.strategy }), [profile.debts, plan.extraDebt, plan.strategy]);
  const trying = extra !== plan.extraDebt;
  const shown = useMemo(
    () => (trying ? payoffLookahead(profile.debts, { extra, strategy: plan.strategy }) : saved),
    [trying, saved, profile.debts, extra, plan.strategy]
  );
  const ghosts = useMemo(
    () => new Set(layout.weeds.filter((w) => (shown.debts[w.debt]?.patchMonths[w.k] ?? Infinity) <= LOOKAHEAD_MONTHS).map((w) => `${w.x}-${w.y}`)),
    [layout, shown]
  );
  const placed = useMemo(() => layout.weeds.reduce((acc, w) => ({ ...acc, [w.debt]: (acc[w.debt] ?? 0) + 1 }), {}), [layout]);
  const wi = { trying, extra, shown, ghosts, placed, weather };

  // Fast-forward to Harvest Festival: a frame of the plan shown, `lapse.t` months from now.
  const [lapse, setLapse] = useState(null); // { t, playing }
  const frame = useMemo(() => (lapse ? lapseFrame({ ahead: shown, profile, m: metrics, t: lapse.t }) : null), [lapse, shown, profile, metrics]);
  // A short festival tune when the fast-forward reaches the Harvest Festival (if sound is on).
  const festival = Boolean(frame?.done);
  useEffect(() => {
    if (festival) sfx("festival");
  }, [festival]);
  useEffect(() => {
    if (!lapse?.playing) return undefined;
    const id = setInterval(() => {
      // Pauses with the tab hidden, and stops at the festival.
      if (document.hidden) return;
      setLapse((l) => (l.t >= (shown.months ?? 0) ? { ...l, playing: false } : { ...l, t: l.t + 1 }));
    }, 260);
    return () => clearInterval(id);
  }, [lapse?.playing, shown.months]);

  // The text box holds either a line of its own or the key of an element, whose numbers stay live
  // while the slider moves (shown instantly then, rather than re-typed on every step).
  const [message, setMessage] = useState({
    text: "Your garden! Everything here grows from your numbers. Tap anything, or pick it from the garden guide, to see the math.",
    speaker: "Sprout",
    font: "pixel",
  });
  const messageText = message.key ? numbersFor(garden, plan, wi, message.key) : message.text;

  const show = (key) => setMessage({ key, speaker: null, font: "read" });
  const onTry = (v) => {
    setExtra(v);
    setStatus("");
    setMessage((m) => (m.key ? { ...m, instant: true } : m));
  };
  const onSave = () => {
    sfx("save");
    setPlan({ extraDebt: extra });
    setStatus(`Saved. Your plan now pays ${money(extra)} extra a month (kept in this browser), and the Classic Debt page shows the same dates.`);
  };
  const onReset = () => onTry(plan.extraDebt);
  const toTown = () => go("garden?from=plot");

  const walker = useWalker({
    world: GARDEN,
    start: GARDEN_SPAWN,
    reduced,
    onEnter: () => show("greenhouse"),
    onArrive: (p) => {
      if (p.x === GATE.x && p.y === GATE.y) toTown();
    },
  });

  // A (or Enter on the map): show the numbers for whatever Sprout faces.
  const interact = () => {
    const [dx, dy] = DIRS[walker.facing];
    const p = walker.posRef.current;
    const x = p.x + dx;
    const y = p.y + dy;
    const el = elementAt(layout, x, y) ?? (inRect(VISITOR_SPOT, x, y) || inRect(VISITOR_SPOT, p.x, p.y) ? { id: "visitors" } : null);
    if (!el) return setMessage({ text: "Nothing here. Face a bed, the greenhouse, the sign or the flowers and press A.", speaker: "Sprout", font: "pixel" });
    return show(el.id === "weeds" ? `weeds:${el.debt}` : el.id);
  };

  // Tapping a plant shows its numbers and walks Sprout over to it.
  const onShow = useStable((key, tile) => {
    show(key);
    if (tile) walker.goTo({ x: tile.x, y: tile.y });
  });
  const stableInteract = useStable(interact);
  const onPick = useStable(show);

  const guide = useMemo(
    () => [
      { key: "soil", label: "Vegetable beds", sub: garden.byId.soil.label },
      ...garden.byId.weeds.weeds.map((w, i) => ({ key: `weeds:${i}`, label: w.name, sub: `${w.patches} ${w.thorny ? "bramble" : "weed"} ${w.patches === 1 ? "patch" : "patches"}` })),
      ...(garden.byId.weeds.weeds.length ? [] : [{ key: "weeds", label: "Weeds", sub: "No weeds" }]),
      { key: "greenhouse", label: "Greenhouse", sub: garden.byId.greenhouse.label },
      { key: "flowers", label: "Flower border", sub: garden.byId.flowers.label },
      { key: "visitors", label: "Visitors", sub: garden.byId.visitors.label },
      { key: "season", label: "Season sign", sub: garden.byId.season.label },
      { key: "weather", label: "Weather", sub: weather.none ? "No forecast yet" : `${SKIES[weather.sky].label} is most common` },
    ],
    [garden, weather]
  );

  const top = (
    <WorldMap
      world={GARDEN}
      walker={walker}
      reduced={reduced}
      label={`Your garden. ${garden.description}${weather.none ? "" : ` Forecast: ${SKIES[weather.sky].label.toLowerCase()} is most common.`}`}
      onInteract={interact}
      onUnreachable={() => setMessage({ text: "Sprout can't get there. Try the grass or the path.", speaker: "Sprout", font: "pixel" })}
    >
      <Plants garden={garden} layout={layout} ghosts={ghosts} ghostNote={planWords(wi)} reduced={reduced} droop={droop} frame={frame} onShow={onShow} />
      {frame?.done && (
        <div className="gs-festival" aria-hidden>
          <div className="gs-bunting" />
          <p className="gs-festival__banner">Harvest Festival · {frame.date}</p>
          {!reduced && <div className="gs-leaves">{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ "--i": i }} />)}</div>}
        </div>
      )}
      {/* The forecast is about retirement, not the debt-free date, so its sky steps aside during the fast-forward. */}
      {!frame && !weather.none && weather.sky !== "sunny" && (
        <div className={`gs-sky gs-sky--${weather.sky}`} aria-hidden>
          {weather.sky === "stormy" ? <div className="gs-rain" /> : <div className="gs-cloud" />}
        </div>
      )}
    </WorldMap>
  );

  const bottomScreen = start.open ? (
    <StartMenu go={go} onClose={start.close} returnTo="garden?scene=plot" battleBack="plot" />
  ) : (
    <div className="gw-panel" ref={bottomRef}>
      <TextBox key={messageText} text={messageText} speaker={message.speaker} font={message.font} instant={instant || message.instant} announce={!message.instant} />
      {message.key?.startsWith("weeds:") && (
        <div className="gs-face">
          <button
            type="button"
            className="gs-btn"
            onClick={() => go(`garden?scene=debt&debt=${encodeURIComponent(garden.byId.weeds.weeds[Number(message.key.split(":")[1])].name)}&return=${encodeURIComponent("garden?scene=plot")}`)}
          >
            Face this debt
          </button>
        </div>
      )}
      <Almanac profile={profile} metrics={metrics} plan={plan} onMissions={() => go(`garden?scene=missions&return=${encodeURIComponent("garden?scene=plot")}`)} />
      {frame ? (
        <LapsePanel
          frame={frame}
          wi={wi}
          plan={plan}
          playing={Boolean(lapse?.playing)}
          reduced={reduced}
          onPlay={() => setLapse((l) => (l.playing ? { ...l, playing: false } : { t: frame.done ? 0 : l.t, playing: true }))}
          onSeek={(t) => setLapse({ t, playing: false })}
          onExit={() => setLapse(null)}
        />
      ) : (
        <HarvestClock
          season={garden.byId.season}
          plan={plan}
          wi={wi}
          saved={saved}
          onTry={onTry}
          onSave={onSave}
          onReset={onReset}
          status={status}
          onLapse={() => {
            walker.stop();
            // With reduced motion there's no autoplay: the scrubber starts at today.
            setLapse({ t: 0, playing: !reduced });
          }}
        />
      )}
      {!profile.fromSurvey && <p className="gs-sample">These are sample numbers. Finish the survey to grow your own garden.</p>}
      <p className="gw-where">
        <EnvironmentOutlined aria-hidden /> Sprout is {GARDEN.describe(walker.pos)}. The gate back to town is at the bottom.
      </p>
      <WalkControls walker={walker} interact={stableInteract} />
      <h3 className="gw-panel__title" id="gs-guide-title">Garden guide · show the numbers</h3>
      <GuideList label="Garden guide: pick something to see its numbers" items={guide} columns={bottom.w >= 520 ? 3 : 2} onSelect={onPick} autoFocus={false} className="gw-goto" />
      {/* The whole garden as text, every number included, so nothing needs to be found by walking. */}
      <details className="gs-all">
        <summary>The whole garden in words</summary>
        <p>{garden.description}</p>
        <dl>
          {guide.map((item) => (
            <div key={item.key}>
              <dt>{item.label}</dt>
              <dd>{numbersFor(garden, plan, wi, item.key)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );

  return (
    <HandheldFrame
      topLabel="Your garden"
      bottomLabel="Garden guide"
      top={top}
      bottom={bottomScreen}
      toolbar={
        <>
          <StartButton open={start.open} onToggle={() => { walker.stop(); start.toggle(); }} />
          <button type="button" className="hh-btn" onClick={() => { walker.stop(); toTown(); }}>
            <HomeOutlined aria-hidden /> Back to town
          </button>
          <ClassicViewButton go={go} onLeave={walker.stop} />
        </>
      }
    />
  );
}
