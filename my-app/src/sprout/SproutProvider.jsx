import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MAX_MESSAGE_LENGTH, streamSprout } from "./sproutClient";

const SproutContext = createContext(null);
const HISTORY_SENT = 20; // only the most recent turns go to the server

export function useSprout() {
  const ctx = useContext(SproutContext);
  if (!ctx) throw new Error("useSprout must be used inside <SproutProvider>");
  return ctx;
}

function loadHistory(key) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "[]");
    // A reply cut off by a refresh is shown as finished, not stuck "typing".
    return Array.isArray(saved) ? saved.map((m) => ({ ...m, streaming: false })) : [];
  } catch {
    return [];
  }
}

/**
 * Holds one Sprout conversation for this browser tab (kept in sessionStorage, never sent to our database).
 * getContext() returns the plan data sent with each question.
 */
export function SproutProvider({ scope, getContext, getAccessToken, children }) {
  const storageKey = `prosperity.sprout.${scope}`;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadHistory(storageKey));
  const [streaming, setStreaming] = useState(false);
  const controller = useRef(null);
  const launcherRef = useRef(null);
  const contextRef = useRef(getContext);
  contextRef.current = getContext;
  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // Storage full or blocked: the chat still works for this visit.
    }
  }, [messages, storageKey]);

  useEffect(() => () => controller.current?.abort(), []);

  const updateLast = (fn) =>
    setMessages((ms) => {
      const copy = ms.slice();
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });

  const ask = useCallback(
    async (rawText) => {
      const text = String(rawText ?? "").trim();
      if (!text || streaming) return false;
      if (text.length > MAX_MESSAGE_LENGTH) return false;
      setOpen(true);

      const now = Date.now();
      const userMsg = { id: `u${now}`, role: "user", text };
      const replyMsg = { id: `a${now}`, role: "assistant", text: "", tools: [], streaming: true };
      const history = [...messages, userMsg]
        .filter((m) => m.text && !m.error)
        .slice(-HISTORY_SENT)
        .map((m) => ({ role: m.role, content: m.text }));
      setMessages((ms) => [...ms, userMsg, replyMsg]);
      setStreaming(true);

      const ac = new AbortController();
      controller.current = ac;
      try {
        const accessToken = (await tokenRef.current?.()) ?? null;
        await streamSprout({
          messages: history,
          context: contextRef.current?.(),
          accessToken,
          signal: ac.signal,
          onEvent: (ev) => {
            if (ev.type === "text") updateLast((m) => ({ ...m, text: m.text + ev.text }));
            else if (ev.type === "tool") updateLast((m) => ({ ...m, tools: [...m.tools, { name: ev.name, label: ev.label, summary: ev.summary }] }));
            else if (ev.type === "error") updateLast((m) => ({ ...m, error: ev.message }));
          },
        });
      } catch (err) {
        if (err?.name !== "AbortError") {
          updateLast((m) => ({ ...m, error: "Sprout couldn't answer just now. Please try again in a moment." }));
        }
      } finally {
        updateLast((m) => ({ ...m, streaming: false, stopped: ac.signal.aborted && !m.error }));
        setStreaming(false);
        controller.current = null;
      }
      return true;
    },
    [messages, streaming]
  );

  const stop = useCallback(() => controller.current?.abort(), []);
  const clear = useCallback(() => {
    controller.current?.abort();
    setMessages([]);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, messages, streaming, ask, stop, clear, launcherRef }),
    [open, messages, streaming, ask, stop, clear]
  );
  return <SproutContext.Provider value={value}>{children}</SproutContext.Provider>;
}
