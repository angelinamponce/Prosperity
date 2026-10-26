import { mockStream } from "./mockSprout";

export const MAX_MESSAGE_LENGTH = 1000;
const FRIENDLY_ERROR = "Sprout couldn't answer just now. Please try again in a moment.";

// Where the Sprout server lives. Empty means this site's own /api (the dev server proxies it to `npm run server`).
const API_BASE = (process.env.REACT_APP_SPROUT_API_URL || "").replace(/\/$/, "");
// REACT_APP_SPROUT_MOCK=1 forces the scripted preview even when a server is reachable.
const FORCE_MOCK = process.env.REACT_APP_SPROUT_MOCK === "1";

/** Whether to use the live server. */
export function checkSproutLive() {
  return Promise.resolve(!FORCE_MOCK && typeof fetch === "function");
}

export function resetSproutLiveCheck() {}

/**
 * Sends the conversation to Sprout and calls onEvent for each streamed event:
 *   { type: "text", text }                       a piece of the reply
 *   { type: "tool", name, label, summary }       a calculator Sprout ran, and its inputs
 *   { type: "done" } | { type: "error", message }
 * With live false, plays the scripted preview replies instead.
 */
export async function streamSprout({ messages, context, accessToken, onEvent, signal, live }) {
  if (!live) return mockStream({ messages, onEvent, signal });

  const res = await fetch(`${API_BASE}/api/sprout/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ messages, context }),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = FRIENDLY_ERROR;
    try {
      // The server only ever sends friendly wording here.
      message = (await res.json()).error || message;
    } catch {
      // Not JSON: keep the friendly default.
    }
    onEvent({ type: "error", message });
    return;
  }

  // Server-sent events: blocks separated by a blank line, each with a "data: {json}" line.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "done" || ev.type === "error") finished = true;
        onEvent(ev);
      } catch {
        // Ignore a malformed event rather than breaking the whole reply.
      }
    }
  }
  // The connection dropped before the reply finished.
  if (!finished) onEvent({ type: "error", message: FRIENDLY_ERROR });
}
