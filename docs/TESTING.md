# Testing

There are three kinds of tests. The first two run on their own; the third is you, with the [test plan](https://claude.ai/artifact/BokNGEvpTu2Ddgcp39YCkz).

| | What it checks | Command | Time |
| --- | --- | --- | --- |
| Unit tests | The logic underneath: fitting scenes to a length, repairing bad AI answers, the backup edit, templates, caption timing | `npm test` | seconds |
| Browser tests | The app clicked through in Chromium like a person would: 8 suites, from importing clips to exporting, the Edit page tools, plans and account | `npm run e2e` | 5–10 min |
| Manual | AI quality, voices, real microphones and phones, Safari, real Stripe payments, how it looks | the test plan | an afternoon |

`npm run test:all` runs lint, the type check, the unit tests and the browser tests one after another.

## Running the tests on your computer

Once:

1. Install [Node.js](https://nodejs.org) 22 or newer. Check with `node -v`.
2. In the project folder:
   ```
   git pull
   npm install
   npx playwright install chromium
   ```
   The last line downloads the browser the tests use (about 150 MB).

Each time:

```
npm run test:all
```

or just the browser tests with `npm run e2e`, or some of them: `npm run e2e -- flow lines`. The suites are `flow`, `variants`, `lines`, `tutorial`, `tutorial-desktop`, `edit`, `effects` and `account`.

You don't need API keys and nothing reaches your Supabase project: the runner starts a stand-in for the AI ([`e2e/stub-ai.mjs`](../e2e/stub-ai.mjs)) and its own copy of the app on port 5179, so it doesn't clash with `npm run dev`. No browser window opens; the tests run in the background.

### Reading the result

The run ends with a summary:

```
✓ PASS  flow                82 s  Core journey: clips, script, AI voice, Make, Edit, Ask AI, undo, export
✗ FAIL  lines               44 s  exit code 1
```

For a failure, scroll up to that suite's section: the last `✓` line is the last step that worked, and the error after it says what didn't. Screenshots are in the `test-results` folder (`lines-fail.png` and others). Send Claude or the developer the error text and the screenshot.

## On every push (GitHub Actions)

Every push to GitHub runs two jobs ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)):

- **check**: lint, type check, unit tests, production build
- **e2e**: the browser tests

See them in the repository's **Actions** tab: green tick means passed, red cross means something broke. Open a red run, click the failed job to see the log; the screenshots are under **Artifacts** (`e2e-screenshots`) at the bottom of the run's page.

## What the automated tests can't tell you

The stand-in AI always gives the same answers, so the tests prove the app *behaves* (buttons work, nothing is lost, the video exports), not that the script is good or the voice sounds natural. They also run only in Chromium, on a computer, with a fake microphone, and fake the Stripe side. Those checks are in the test plan without the **auto** tag; tick "Hide checks the automated tests cover" there to see only them.

## Adding a test

Each suite is a plain script in [`e2e/`](../e2e) using [Playwright](https://playwright.dev/docs/api/class-page). Add it to `SUITES` in [`e2e/run.mjs`](../e2e/run.mjs). If it needs a new AI answer, add it to `e2e/stub-ai.mjs`. Test videos are in `e2e/fixtures` (regenerate with `npm run test-clips`, which needs ffmpeg).
