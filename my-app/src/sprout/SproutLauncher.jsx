import { useEffect, useState } from "react";
import SproutMascot from "./SproutMascot";
import { useSprout } from "./SproutProvider";

const GREETED_KEY = "prosperity.sprout.greeted";

/** Floating round button that opens the Sprout panel, with a one-time hello bubble. */
export default function SproutLauncher({ greeting = "Hi! I'm Sprout. Questions about your plan?" }) {
  const { open, setOpen, launcherRef } = useSprout();
  const [showHello, setShowHello] = useState(false);

  useEffect(() => {
    let greeted = true;
    try {
      greeted = sessionStorage.getItem(GREETED_KEY) === "1";
    } catch {
      // No storage: skip the bubble.
    }
    if (greeted) return undefined;
    const show = setTimeout(() => {
      setShowHello(true);
      try {
        sessionStorage.setItem(GREETED_KEY, "1");
      } catch {
        // ignore
      }
    }, 2500);
    const hide = setTimeout(() => setShowHello(false), 9500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    if (open) setShowHello(false);
  }, [open]);

  return (
    <div className="sp-launcher-wrap">
      {showHello && !open && (
        <div className="sp-hello" role="status">
          <span>{greeting}</span>
          <button type="button" className="sp-hello__close" aria-label="Dismiss greeting" onClick={() => setShowHello(false)}>
            ×
          </button>
        </div>
      )}
      <button
        ref={launcherRef}
        type="button"
        className={`sp-launcher${open ? " is-open" : ""}`}
        aria-label={open ? "Close Sprout, your AI money guide" : "Ask Sprout, your AI money guide"}
        aria-expanded={open}
        aria-controls="sprout-panel"
        onClick={() => setOpen(!open)}
      >
        <SproutMascot variant="head" size={44} mood={open ? "idle" : "wave"} />
      </button>
    </div>
  );
}
