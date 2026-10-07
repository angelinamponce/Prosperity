import { mockStream } from "./mockSprout";

export const MAX_MESSAGE_LENGTH = 1000;

// Step 1 uses scripted replies. Set REACT_APP_SPROUT_MOCK=0 once the server route exists.
export const USING_MOCK = process.env.REACT_APP_SPROUT_MOCK !== "0";

/**
 * Sends the conversation to Sprout and calls onEvent for each streamed event:
 *   { type: "text", text }                       a piece of the reply
 *   { type: "tool", name, label, summary }       a calculator Sprout ran, and its inputs
 *   { type: "done" } | { type: "error", message }
 */
export async function streamSprout({ messages, context, accessToken, onEvent, signal }) {
  if (USING_MOCK) return mockStream({ messages, onEvent, signal });

  const res = await fetch("/api/sprout/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ messages, context }),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = "Sprout couldn't answer just now. Please try again in a moment.";
    try {
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
        onEvent(JSON.parse(data));
      } catch {
        // Ignore a malformed event rather than breaking the whole reply.
      }
    }
  }
}
