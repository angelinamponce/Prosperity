import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { MenuOutlined } from "@ant-design/icons";
import { useGame } from "../game/store";
import { GLOSSARY } from "../dashboard/glossary";
import { TextBox } from "./TextBox";
import { ListMenu } from "./ListMenu";
import { setSoundEnabled, sfx } from "./sound";

/** Open/close state for the Start menu. Closing puts focus back on the Start button. */
export function useStartMenu() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    setTimeout(() => document.querySelector('[aria-controls="start-menu"]')?.focus(), 0);
  }, []);
  const toggle = useCallback(() => (open ? close() : setOpen(true)), [open, close]);
  return { open, close, toggle };
}

/** The hinge button that opens the Start menu on the touch screen. */
export function StartButton({ open, onToggle }) {
  return (
    <button type="button" className="hh-btn" aria-expanded={open} aria-controls="start-menu" onClick={onToggle}>
      <MenuOutlined aria-hidden /> Start
    </button>
  );
}

/**
 * The Start menu, shown on the touch screen in place of the scene's own guide. `returnTo` is the route
 * that puts Sprout back where they were (the Gardener Card and Missions come back to it). Escape or
 * Close returns to the scene. Settings and Save are pages inside the menu.
 */
export function StartMenu({ go, onClose, returnTo, battleBack, missionsLeft }) {
  const game = useGame();
  const [page, setPage] = useState("main");
  const s = game?.progress.settings ?? {};
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  // Every money word has a Dex plant, so the glossary is the count (and keeps the Dex code out of town).
  const words = Object.keys(GLOSSARY);
  const planted = game?.ready ? words.filter((k) => game.progress.terms[k]).length : 0;
  const back = encodeURIComponent(returnTo);

  if (page === "settings") {
    const dpad = s.dpad ?? coarse;
    return (
      <div className="gw-panel" id="start-menu">
        <TextBox text="Settings. Changes save right away." instant />
        <ListMenu
          label="Settings"
          className="gw-goto"
          items={[
            { key: "sound", label: `Sound effects: ${s.sound ? "on" : "off"}`, sub: "Short, quiet sounds for menus and big moments" },
            { key: "instantText", label: `Instant text: ${s.instantText ? "on" : "off"}`, sub: "Show whole lines at once instead of typing them out" },
            { key: "dpad", label: `On-screen D-pad: ${dpad ? "on" : "off"}`, sub: "Arrow buttons for walking on touch screens" },
            { key: "encounters", label: `Tall-grass battles: ${s.encounters !== false ? "on" : "off"}`, sub: "Whether the tall grass ever rustles (it always asks first)" },
            { key: "back", label: "Back" },
          ]}
          onSelect={(k) => {
            if (k === "back") return setPage("main");
            if (k === "sound") {
              const on = !s.sound;
              game?.setSetting("sound", on);
              // A small chime so you know it's on.
              setSoundEnabled(on);
              return on && sfx("save");
            }
            if (k === "dpad") return game?.setSetting("dpad", !dpad);
            if (k === "encounters") return game?.setSetting("encounters", s.encounters === false);
            return game?.setSetting(k, !s[k]);
          }}
          onBack={() => setPage("main")}
        />
        <p className="gw-start-note">Animations follow your device's reduced-motion setting. Sound effects stay off unless you turn them on.</p>
      </div>
    );
  }

  if (page === "save") {
    const guest = game?.id === "guest";
    return (
      <div className="gw-panel" id="start-menu">
        <TextBox
          font="read"
          instant
          text={`Your progress saves by itself after every step, in this browser on this device.${guest ? " You're not signed in, so it stays in this browser only." : ""} Your money numbers come from your survey, so the garden always matches them.`}
        />
        {guest && (
          <p className="gw-start-note">
            <Link to="/signup">Create a free account</Link> to keep your plan anywhere.
          </p>
        )}
        <ListMenu label="Save" className="gw-goto" items={[{ key: "back", label: "Back" }]} onSelect={() => setPage("main")} onBack={() => setPage("main")} />
      </div>
    );
  }

  const onSelect = (k) => {
    if (k === "card") return go(`garden?scene=card&return=${back}`);
    if (k === "dex") return go("garden?scene=dex");
    if (k === "missions") return go(`garden?scene=missions&return=${back}`);
    if (k === "battle") return go(`battle?from=garden&back=${battleBack}`);
    if (k === "settings" || k === "save") return setPage(k);
    return onClose();
  };
  return (
    <div className="gw-panel" id="start-menu">
      <TextBox text="Start menu. Where to?" instant />
      <ListMenu
        label="Start menu"
        columns={2}
        className="gw-goto"
        items={[
          { key: "card", label: "Gardener Card", sub: "Your level, badges and plan" },
          { key: "dex", label: "Garden Dex", sub: `${planted} of ${words.length} planted` },
          { key: "missions", label: "Missions", sub: missionsLeft ? `${missionsLeft} to try` : "Today's quest" },
          { key: "battle", label: "Quick battle", sub: "3 questions, picked for you" },
          { key: "settings", label: "Settings", sub: "Sound, text, D-pad, tall grass" },
          { key: "save", label: "Save", sub: "Saved automatically" },
          { key: "close", label: "Close menu" },
        ]}
        onSelect={onSelect}
        onBack={onClose}
      />
    </div>
  );
}
