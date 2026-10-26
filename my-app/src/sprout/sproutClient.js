import { mockStream } from "./mockSprout";

export const MAX_MESSAGE_LENGTH = 1000;
const FRIENDLY_ERROR = "Sprout couldn't answer just now. Please try again in a moment.";

// Where the Sprout server lives. Empty means this site's own /api (the dev server proxies it to `npm run server`).
const API_BASE = (process.env.REACT_APP_SPROUT_API_URL || "").replace(/\/$/, "");
// REACT_APP_SPROUT_MOCK=1 forces the scripted preview even when a server is reachable.
const FORCE_MOCK = process.env.REACT_APP_SPROUT_MOCK === "1";

let liveCheck = null;

/**
 * Resolves true when the Sprout server is up and has an API key. Asked once per page load.
 * Anything else (no server, as on GitHub Pages; no key; offline) means scripted preview mode.
 */
export function checkSproutLive() {
  if (FORCE_MOCK || typeof fetch !== "function") return Promise.resolve(false);
  if (!liveCheck) {
    const ac = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => ac?.abort(), 4000);
    liveCheck = fetch(`${API_BASE}/api/sprout/status`, { signal: ac?.signal })
      .then((res) => (res.ok ? res.json() : { live: false }))
      .then((body) => body?.live === true)
      .catch(() => false)
      .finally(() => clearTimeout(timer));
  }
  return liveCheck;
}

/** For tests: forget the cached answer so the next check asks again. */
export function resetSproutLiveCheck() {
  liveCheck = null;
}

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
