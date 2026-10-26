# Deploying Sprout's API

The website stays on GitHub Pages. Sprout's chat API (`my-app/server`) runs on Render, set up from `render.yaml`.
Sprout answers with Google Gemini on the free tier (`gemini-3.5-flash-lite`, falling back to `gemini-3.8-flash` when it's
overloaded or out of quota); Claude is still supported (see the end).

Free-tier note: on Google's free tier, prompts and answers may be used to improve Google's products, which is why the chat
says "Demo AI — don't enter real account details." The free tier also has per-minute and per-day request limits; when
a model answers 429 (quota used up) the next model takes over, and that model is skipped until Google says to retry
(until midnight Pacific for a daily quota). Only when every model is used up does the chat switch to scripted preview replies.
Until the API is reachable, the chat falls back to scripted preview replies on its own, so nothing breaks in between.

## 1. Put the code on `main`

Render deploys from `main`. Merge the branch and push (this also redeploys the website, still in preview mode).

## 2. Create the Render service from the Blueprint

1. Sign in at [dashboard.render.com](https://dashboard.render.com).
2. Click **New** (top right) → **Blueprint**.
3. If GitHub isn't connected yet, click **Connect GitHub**, allow Render to see `angelinamponce/Prosperity`, and come back.
4. Next to **angelinamponce/Prosperity**, click **Connect**.
5. Give the Blueprint a name (for example `prosperity`), choose branch **main**, and leave **Blueprint Path** as `render.yaml`.
6. Render lists one service to create: **prosperity-sprout-api** (Web Service, Free).
7. It asks for **GEMINI_API_KEY**: paste your key here (create one in Google AI Studio at
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key**; a project without billing
   stays on the free tier). It never goes in the repo or the website.
8. Click **Deploy Blueprint** and wait for the deploy to show **Live** (a few minutes).
9. Copy the service URL shown under the service name, like `https://prosperity-sprout-api.onrender.com`.
   Render adds a suffix if that name is taken, so use the URL it shows you.

Check it in a browser:
- `https://<your-service>.onrender.com/healthz` shows `{"ok":true}`
- `https://<your-service>.onrender.com/api/sprout/status` shows `{"live":true}` (`false` means the key is missing,
  or the daily cap or Gemini's quota is used up)

**Missed the key, or need to change it?** Open the service → **Environment** → find `GEMINI_API_KEY` (or **Add Environment Variable**) → paste → **Save, rebuild, and deploy**.

**Already created the service back when it used Claude?** Render's Blueprint sync adds the new plain settings
(`SPROUT_LLM_PROVIDER`, `SPROUT_GEMINI_MODELS`) but never asks for a new secret. Open the service → **Environment** →
**Add Environment Variable** → `GEMINI_API_KEY` = your key → **Save, rebuild, and deploy**. You can then delete
`ANTHROPIC_API_KEY` and `SPROUT_MODEL` there. Check `/api/sprout/status` again afterwards.

Keep the key on a Google Cloud project with no billing account, so it can only use the free tier.

## 3. Point the website at the API

1. On GitHub, open the repo → **Settings** → **Secrets and variables** → **Actions**.
2. Choose the **Variables** tab (not Secrets) → **New repository variable**.
3. Name: `REACT_APP_SPROUT_API_URL`. Value: the Render URL from step 2.9, with no trailing slash.
4. Click **Add variable**.
5. Rebuild the site: **Actions** → **Deploy to GitHub Pages** → **Run workflow** → branch `main` → **Run workflow**.

When it finishes, open the site and the Sprout chat. The "Preview mode" note is gone, and the first answer
after a quiet spell shows "Sprout is waking up…" for up to a minute (Free instances sleep).

## 4. Later: switch from Free to Starter (no sleeping)

1. In Render, open **prosperity-sprout-api** → **Compute** (left menu, under Settings) → **Edit**.
2. Choose **Starter** (0.5 CPU, 512 MB) → **Save**. Render redeploys with no downtime.
3. Also change `plan: free` to `plan: 0.5c-512mb` in `render.yaml` and push, so a later Blueprint sync doesn't switch it back.

## What's configured (render.yaml)

| Variable | Value | Notes |
|---|---|---|
| `SPROUT_LLM_PROVIDER` | `gemini` | `gemini` or `anthropic` |
| `GEMINI_API_KEY` | (you paste it) | Secret, set only in the Render dashboard |
| `SPROUT_GEMINI_MODELS` | `gemini-3.5-flash-lite,gemini-3.8-flash` | Tried in order. A model that's overloaded (503) gets one retry, then the next one answers; a model out of quota (429) is skipped until Google's retry time (or midnight Pacific for a daily quota). If none starts within about 20 seconds, or all are out of quota, the chat uses preview replies. Change it in `render.yaml`, not the dashboard, so a Blueprint sync keeps it. Free-tier models: [pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| `SPROUT_EFFORT` | `low` | Short chat answers (Gemini's thinking level, or Claude's effort) |
| `SPROUT_ALLOWED_ORIGINS` | `https://angelinamponce.github.io` | The only site allowed to use the chat. In production, localhost and requests with no Origin header (curl, scripts) are refused |
| `SPROUT_DAILY_MESSAGE_CAP` | `300` | Messages per UTC day across everyone |
| `SPROUT_DAILY_TOKEN_CAP` | `1500000` | Tokens per UTC day across everyone. Past either cap, the chat shows preview replies until midnight UTC |
| `SPROUT_TRUST_PROXY` | `1` | Rate limits use the visitor's IP, not Render's proxy |
| `NODE_ENV` | `production` | |
| `NODE_VERSION` | `24` | |

Optional: `SPROUT_RATE_PER_MINUTE` (default 8) and `SPROUT_RATE_PER_DAY` (default 80) per visitor.

## If something's wrong

- **Chat still says "Preview mode"**: check that `/api/sprout/status` says `live: true`, that the GitHub variable
  is set, and that the Pages workflow ran after you set it. Open DevTools → Network and look for `/api/sprout/status`.
- **Preview mode came back later in the day**: the daily cap was reached. The log says `daily cap reached`; it resets at
  midnight UTC (or on a restart). Raise `SPROUT_DAILY_MESSAGE_CAP` / `SPROUT_DAILY_TOKEN_CAP` under **Environment** if needed.
  If the log says `Gemini quota used up on every model` instead, every model's free-tier limit was hit; live answers come
  back when the first one frees up (lines like `gemini 429 from <model> (rate limit|daily quota); skipping it for Ns` say
  which and for how long). Your limits are in AI Studio → **Rate limit**.
- **Log says `Gemini unavailable (tried …)`**: every model in `SPROUT_GEMINI_MODELS` was overloaded or too slow to start,
  so that visitor got preview replies. It's Google's capacity, usually brief. Each answer's log line names the model that
  served it (`model=…`).
- **A CORS error in the browser console**: `SPROUT_ALLOWED_ORIGINS` must be exactly `https://angelinamponce.github.io` (no path, no trailing slash).
- **Logs**: Render → service → **Logs**. Each answer logs the provider/model, its tools and token counts.

## Switching back to Claude

In Render → **Environment**: set `SPROUT_LLM_PROVIDER` to `anthropic`, add `ANTHROPIC_API_KEY` (from
[platform.claude.com](https://platform.claude.com) → **API Keys**; set a monthly spend limit there) and optionally
`SPROUT_MODEL` (default `claude-sonnet-5-5`) → **Save, rebuild, and deploy**. Also change `SPROUT_LLM_PROVIDER` in
`render.yaml` so a later Blueprint sync doesn't switch it back.
