// Sprout's API server. Run with `npm run server` (reads .env.local), then `npm start` proxies /api to it.
// The key stays here: the browser never sees GEMINI_API_KEY (or ANTHROPIC_API_KEY).

import http from "node:http";
import { createSproutHandler } from "./chat.mjs";
import { createLlm, keyName } from "./llm/index.mjs";

const port = Number(process.env.PORT || process.env.SPROUT_PORT) || 8787;
const llm = createLlm();
const handle = createSproutHandler({ llm });

http
  .createServer(async (req, res) => {
    if (!(await handle(req, res))) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(port, () => {
    console.log(
      `Sprout server on http://localhost:${port} (${
        llm ? `live, ${llm.name} model ${llm.model}` : `no ${keyName()}: the app will use scripted preview replies`
      })`
    );
  });
