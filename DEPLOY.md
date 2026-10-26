# Deploying Sprout's API

The website stays on GitHub Pages. Sprout's chat API (`my-app/server`) runs on Render, set up from `render.yaml`.
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
7. It asks for **ANTHROPIC_API_KEY**: paste your key here (create one in the Claude Console at [platform.claude.com](https://platform.claude.com) → **API Keys**). It never goes in the repo or the website.
8. Click **Deploy Blueprint** and wait for the deploy to show **Live** (a few minutes).
9. Copy the service URL shown under the service name, like `https://prosperity-sprout-api.onrender.com`.
   Render adds a suffix if that name is taken, so use the URL it shows you.

Check it in a browser:
- `https://<your-service>.onrender.com/healthz` shows `{"ok":true}`
- `https://<your-service>.onrender.com/api/sprout/status` shows `{"live":true}` (`false` means the key is missing)

**Missed the key, or need to change it?** Open the service → **Environment** → find `ANTHROPIC_API_KEY` (or **Add Environment Variable**) → paste → **Save, rebuild, and deploy**.

Tip: set a monthly spend limit for the key in the Claude Console.

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
| `ANTHROPIC_API_KEY` | (you paste it) | Secret, set only in the Render dashboard |
| `SPROUT_MODEL` | `claude-sonnet-5-5` | Change here or in the dashboard |
| `SPROUT_EFFORT` | `low` | Short chat answers |
| `SPROUT_ALLOWED_ORIGINS` | `https://angelinamponce.github.io` | The only site allowed to call the API (localhost is refused in production) |
| `SPROUT_TRUST_PROXY` | `1` | Rate limits use the visitor's IP, not Render's proxy |
| `NODE_ENV` | `production` | |
| `NODE_VERSION` | `24` | |

Optional: `SPROUT_RATE_PER_MINUTE` (default 8) and `SPROUT_RATE_PER_DAY` (default 80) per visitor.

## If something's wrong

- **Chat still says "Preview mode"**: check that `/api/sprout/status` says `live: true`, that the GitHub variable
  is set, and that the Pages workflow ran after you set it. Open DevTools → Network and look for `/api/sprout/status`.
- **A CORS error in the browser console**: `SPROUT_ALLOWED_ORIGINS` must be exactly `https://angelinamponce.github.io` (no path, no trailing slash).
- **Logs**: Render → service → **Logs**. Each answer logs its tools and token counts, which is also how to check cost.
