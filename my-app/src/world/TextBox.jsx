import { useEffect, useRef, useState } from "react";

const CHAR_MS = 22;

/**
 * The classic bordered text box. Text types out unless `instant` (the instant-text setting or reduced
 * motion). While `waiting`, a blinking arrow invites the player on: the first press finishes the line,
 * the next calls `onContinue`. Screen readers get each full line once, through a polite live region.
 * `font`: "pixel" for short game lines, "read" for explanations and numbers.
 * `announce={false}` updates the text without re-reading it aloud (say, numbers refreshing while a slider moves).
 */
export function TextBox({ text, font = "pixel", instant, paused, waiting, onContinue, speaker, announce = true }) {
  const [shown, setShown] = useState(instant ? text.length : 0);
  const btnRef = useRef(null);
  const spoken = useRef(text);
  if (announce) spoken.current = text;
  const done = shown >= text.length;

  useEffect(() => {
    setShown(instant ? text.length : 0);
  }, [text, instant]);

  useEffect(() => {
    if (done || paused) return undefined;
    const id = setInterval(() => setShown((n) => Math.min(text.length, n + 1)), CHAR_MS);
    return () => clearInterval(id);
  }, [done, paused, text]);

  useEffect(() => {
    if (waiting) btnRef.current?.focus({ preventScroll: true });
  }, [waiting, text]);

  const press = () => {
    if (!waiting) return;
    if (!done) setShown(text.length);
    else onContinue?.();
  };

  return (
    <div className={`tb tb--${font}${waiting ? " is-waiting" : ""}`} onClick={press}>
      {speaker && <span className="tb__speaker">{speaker}</span>}
      <p className="tb__text" aria-hidden>
        {text.slice(0, shown)}
        <span className="tb__ghost">{text.slice(shown)}</span>
      </p>
      <p className="ps-sr-only" aria-live="polite">
        {speaker ? `${speaker}: ` : ""}
        {spoken.current}
      </p>
      {waiting && (
        <button
          ref={btnRef}
          type="button"
          className={`tb__next${done ? " is-ready" : ""}`}
          aria-label={done ? "Continue" : "Show all text"}
          onClick={(e) => {
            e.stopPropagation();
            press();
          }}
        >
          <span aria-hidden>▼</span>
        </button>
      )}
    </div>
  );
}
