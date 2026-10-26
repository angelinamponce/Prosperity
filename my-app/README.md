# Prosperity

A friendly money dashboard with Sprout, a seedling who grows as you learn. It has two views that share
one plan and one save:

- **Classic View** (the default): the accessible dashboard. Overview, cash flow, debt payoff, investing,
  possible futures, goals, quizzes and progress.
- **Garden mode**: the same plan as a small handheld-style game. A town you can walk around, a garden
  grown from your real numbers, quiz and debt battles, a forecast, and the Garden Dex.

Nothing important is game-only: everything in Garden mode has a Classic equivalent.

## What's where (`src/`)

| Folder | What it holds |
|---|---|
| `dashboard/` | Classic pages, the finance math (`finance.js`: metrics, payoff and market simulations), plain-language summaries, the glossary |
| `game/` | The game layer, all pure and tested: XP, levels, badges, streak and the save format (`rules.js`, `store.js`); the garden from your numbers (`garden.js`); the Dex, keepers, debt battle, weather, Almanac, tips, daylight |
| `quiz/` | The question bank, "uses your numbers" templates, spaced-repetition picker, quiz sessions and stats |
| `world/` | Garden mode screens: the handheld frame, walking engine, town and garden maps, every scene, original pixel art, sound effects |
| `battle/` | Quiz and keeper battles, Misconception and keeper art |
| `design/` | The design system: tokens, components, charts, formatting |
| `sprout/` | The Sprout chat: panel, streaming client, scripted preview replies, and `tools.js` (the calculators Sprout runs) |

## Sprout, the AI guide (`server/`)

Sprout answers with Claude through a small Node server, so the API key never reaches the browser.

- `npm run server` installs its one dependency (`server/package.json`) and starts it on port 8787, reading `.env.local`
  (see `.env.example`); `npm start` proxies `/api` to it. In production it runs on Render: see `../DEPLOY.md`.
- Claude never does the math: the server runs Prosperity's own calculators (`src/sprout/tools.js`) as tools and
  the chat shows which one each answer came from. The system prompt is in `server/prompts/sprout.mjs`.
- No `ANTHROPIC_API_KEY`, or no server at all (as on GitHub Pages), means scripted preview replies with a notice.
- `npm run test:server` tests the route with a fake Claude client.

## Ground rules the game layer follows

- The garden is never stored: it's recomputed from your survey numbers, so it can't drift or invent progress.
- XP rewards learning and habits, never dollar amounts. Help is free, wrong answers cost nothing, nothing is lost.
- Every date says which plan it comes from; what-ifs are labeled and only change your plan when you press Save.
- Projections and assumptions are labeled; nothing promises returns.
- Accessibility: keyboard and screen-reader support, reduced motion, WCAG AA contrast, and Classic View as a full alternative.
- All art, names and sounds are original. Sound is off by default.

## Testing and deploying

- `npm test` runs the Jest suite (pure logic plus key screens); `npm run test:server` runs the Sprout server tests (Node 22+).
- `main` deploys to GitHub Pages through GitHub Actions, which runs the tests first. Work happens on a branch and is fast-forwarded to `main`.

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
