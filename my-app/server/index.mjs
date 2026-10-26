// Sprout's API server. Run with `npm run server` (reads .env.local), then `npm start` proxies /api to it.
// The key stays here: the browser never sees ANTHROPIC_API_KEY.

import http from "node:http";
import { createSproutHandler } from "./chat.mjs";

const port = Number(process.env.PORT || process.env.SPROUT_PORT) || 8787;
const handle = createSproutHandler();

http
  .createServer(async (req, res) => {
    if (!(await handle(req, res))) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(port, () => {
    const live = Boolean(process.env.ANTHROPIC_API_KEY);
    console.log(
      `Sprout server on http://localhost:${port} (${
        live ? `live, model ${process.env.SPROUT_MODEL || "claude-sonnet-5-5"}` : "no ANTHROPIC_API_KEY: the app will use scripted preview replies"
      })`
    );
  });
