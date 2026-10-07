import { useEffect, useRef, useState } from "react";
import SproutMascot from "./SproutMascot";
import SuggestedQuestions from "./SuggestedQuestions";
import { useSprout } from "./SproutProvider";
import { MAX_MESSAGE_LENGTH, USING_MOCK } from "./sproutClient";

// Renders **bold**, paragraphs and "- " bullet lists as React nodes (never as HTML).
function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

export function RichText({ text }) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block, i) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        return (
          <ul key={i}>
            {lines.map((l, j) => (
              <li key={j}>
                <Inline text={l.replace(/^\s*[-•]\s+/, "")} />
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={i}>
          {lines.map((l, j) => (
            <span key={j}>
              {j > 0 && <br />}
              <Inline text={l} />
            </span>
          ))}
        </p>
      );
    });
}

function Typing() {
  return (
    <span className="sp-typing" aria-label="Sprout is thinking">
      <span />
      <span />
      <span />
    </span>
  );
}

function Message({ m, onRetry }) {
  if (m.role === "user") {
    return (
      <li className="sp-msg sp-msg--user">
        <div className="sp-bubble">{m.text}</div>
      </li>
    );
  }
  return (
    <li className="sp-msg sp-msg--sprout">
      <SproutMascot variant="head" size={30} mood={m.streaming ? "thinking" : "idle"} />
      <div className="sp-msg__body">
        {m.tools?.length > 0 && (
          <ul className="sp-tools" aria-label="Calculations Sprout ran">
            {m.tools.map((t, i) => (
              <li key={i} className="sp-tool">
                <span className="sp-tool__dot" aria-hidden />
                <span>
                  <strong>{t.label}</strong>
                  {t.summary && <span className="sp-tool__inputs"> · {t.summary}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(m.text || m.streaming) && (
          <div className="sp-bubble">{m.text ? <RichText text={m.text} /> : <Typing />}</div>
        )}
        {m.error && (
          <div className="sp-error" role="alert">
            {m.error}{" "}
            <button type="button" className="sp-link" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
        {m.stopped && <p className="sp-meta">Stopped.</p>}
      </div>
    </li>
  );
}

export default function SproutChat({ starters = [], title = "Sprout" }) {
  const { open, setOpen, messages, streaming, ask, stop, clear, launcherRef } = useSprout();
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [announce, setAnnounce] = useState("");

  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Keep the newest text in view while it streams.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // Screen readers hear each finished reply once, not every streamed word.
  const last = messages[messages.length - 1];
  useEffect(() => {
    if (last?.role === "assistant" && !last.streaming && (last.text || last.error)) {
      setAnnounce(last.error ? last.error : `Sprout says: ${last.text.replace(/\*\*/g, "")}`);
    }
  }, [last]);

  if (!open) return null;

  const send = async (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft("");
    await ask(text);
    inputRef.current?.focus();
  };

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) ask(lastUser.text);
  };

  const remaining = MAX_MESSAGE_LENGTH - draft.length;

  return (
    <section
      id="sprout-panel"
      className="sp-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="sprout-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <header className="sp-panel__head">
        <SproutMascot variant="head" size={40} mood={streaming ? "thinking" : "idle"} />
        <div className="sp-panel__titles">
          <h2 id="sprout-title" className="sp-panel__title">{title}</h2>
          <p className="sp-panel__note">AI guide, not a licensed advisor.</p>
        </div>
        {messages.length > 0 && (
          <button type="button" className="sp-icon-btn" onClick={clear} aria-label="Start a new conversation" title="New conversation">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
              <path d="M4 10a6 6 0 1 0 2-4.5M4 3v3.5h3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <button type="button" className="sp-icon-btn" onClick={close} aria-label="Close Sprout">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="sp-panel__body" ref={listRef}>
        {messages.length === 0 ? (
          <div className="sp-welcome">
            <SproutMascot variant="full" size={96} mood="wave" />
            <p className="sp-welcome__title">Hi, I'm Sprout!</p>
            <p className="sp-welcome__text">
              Ask me anything about your plan. When you ask about numbers, I'll run Prosperity's own calculators and show you which ones I used.
            </p>
            {starters.length > 0 && <SuggestedQuestions questions={starters} label="Suggested questions" className="sp-chips--stack" />}
          </div>
        ) : (
          <ol className="sp-log" aria-label="Conversation with Sprout">
            {messages.map((m) => (
              <Message key={m.id} m={m} onRetry={retry} />
            ))}
          </ol>
        )}
        <div className="sp-sr" aria-live="polite">{announce}</div>
      </div>

      <form className="sp-composer" onSubmit={send}>
        {USING_MOCK && <p className="sp-meta sp-meta--mock">Preview mode: replies are scripted examples.</p>}
        <div className="sp-composer__row">
          <textarea
            ref={inputRef}
            className="sp-input"
            rows={1}
            value={draft}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Ask about your plan…"
            aria-label="Message Sprout"
            aria-describedby={remaining < 200 ? "sp-count" : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
            }}
          />
          {streaming ? (
            <button type="button" className="sp-send sp-send--stop" onClick={stop} aria-label="Stop Sprout's reply">
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
                <rect x="5" y="5" width="10" height="10" rx="2" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button type="submit" className="sp-send" disabled={!draft.trim()} aria-label="Send">
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
                <path d="M10 16V4M5 9l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
        {remaining < 200 && (
          <p id="sp-count" className={`sp-meta${remaining < 0 ? " is-over" : ""}`}>
            {remaining} characters left
          </p>
        )}
      </form>
    </section>
  );
}
