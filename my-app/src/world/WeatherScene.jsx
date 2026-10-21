import { useMemo, useState } from "react";
import { HomeOutlined } from "@ant-design/icons";
import { prefersReducedMotion } from "../design";
import { useGame } from "../game/store";
import { SKIES, assumptionsText, brighten, forecast, forecastText, sharePct } from "../game/weather";
import { HandheldFrame } from "./HandheldFrame";
import { TextBox } from "./TextBox";
import { ListMenu } from "./ListMenu";
import { PixelArt } from "./PixelArt";
import { ClassicViewButton } from "./GardenWorld";
import { WEATHER_ART, WEATHER_PALETTE } from "./weatherArt";
import "./weather.css";

/**
 * The Weather Station: the 500 simulated futures from the Possible futures page as a forecast.
 * Sunny reaches the goal, mixed gets at least halfway, stormy ends less than halfway. Always shown as
 * numbers too, with the assumptions, and with what could brighten it. Nothing is guaranteed.
 */
export default function WeatherScene({ profile, metrics, plan, go, query }) {
  const game = useGame();
  const reduced = Boolean(prefersReducedMotion());
  const instant = Boolean(game?.progress.settings.instantText) || reduced;
  const returnTo = query?.get("return") || "garden?from=weather";
  const f = useMemo(() => forecast(profile, metrics, plan), [profile, metrics, plan]);
  const ideas = useMemo(() => brighten(profile, metrics, plan), [profile, metrics, plan]);
  const [shown, setShown] = useState("forecast");

  const TEXT = {
    forecast: `${forecastText(f)}${profile.fromSurvey ? "" : " (These are sample numbers.)"}`,
    brighten: f.none
      ? forecastText(f)
      : `What could brighten it, with everything else the same: ${ideas
          .map((o) => `${o.label.toLowerCase()}, and sunny futures go from ${sharePct(o.from)} to ${sharePct(o.sunny)}`)
          .join("; ")}. Small, steady changes add up. Even when it's stormy, nothing in your garden is lost, and a storm always passes.`,
    how: f.none
      ? forecastText(f)
      : `Each of the 500 futures plays out your investing month by month with ups and downs. Sunny ${SKIES.sunny.means}; mixed ${SKIES.mixed.means}; stormy ${SKIES.stormy.means}. ${assumptionsText(f)}`,
  };

  const top = (
    <div className={`ws-view ws-view--${f.none ? "sunny" : f.sky}`}>
      {!reduced && !f.none && f.sky === "stormy" && <div className="ws-rain" aria-hidden />}
      {f.none ? (
        <p className="ws-none">No forecast yet</p>
      ) : (
        <ul className="ws-cards" aria-label="Forecast from 500 simulated futures">
          {["sunny", "mixed", "stormy"].map((k) => (
            <li key={k} className={`ws-card${f.sky === k ? " is-most" : ""}`}>
              <PixelArt rows={WEATHER_ART[k]} palette={WEATHER_PALETTE} size={56} />
              <span className="ws-card__label">{SKIES[k].label}</span>
              <span className="ws-card__pct">{sharePct(f[k])}</span>
              <span className="ws-card__of">{Math.round(f[k] * 500)} of 500</span>
            </li>
          ))}
        </ul>
      )}
      <p className="ws-caption">{f.none ? "Finish the survey to see your weather." : `Most common: ${SKIES[f.sky].label.toLowerCase()} · to age ${f.input.retireAge}`}</p>
    </div>
  );

  const bottom = (
    <div className="gw-panel">
      <TextBox key={shown} text={TEXT[shown]} font="read" instant={instant} />
      {!f.none && <p className="gs-clock__note">{assumptionsText(f)}</p>}
      <ListMenu
        label="Weather Station"
        columns={2}
        autoFocus={false}
        className="gw-goto"
        items={[
          { key: "forecast", label: "Today's forecast", sub: f.none ? "No forecast yet" : `${SKIES[f.sky].label} is most common` },
          { key: "brighten", label: "What could brighten it", sub: "Small changes, same simulation" },
          { key: "how", label: "How it's worked out", sub: "500 futures, the assumptions" },
          { key: "future", label: "Possible futures", sub: "The full chart (Classic page)" },
          { key: "leave", label: "Leave", sub: "Back to town" },
        ]}
        onSelect={(k) => (k === "future" ? go("future") : k === "leave" ? go(returnTo) : setShown(k))}
      />
    </div>
  );

  return (
    <HandheldFrame
      topLabel="Weather Station forecast"
      bottomLabel="Weather Station"
      top={top}
      bottom={bottom}
      toolbar={
        <>
          <button type="button" className="hh-btn" onClick={() => go(returnTo)}>
            <HomeOutlined aria-hidden /> Back to town
          </button>
          <ClassicViewButton go={go} />
        </>
      }
    />
  );
}
