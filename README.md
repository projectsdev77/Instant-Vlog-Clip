# Instant Vlog Clip

Turn raw phone footage into a short, narrated vlog. Add clips, write a few lines (or let AI write them), pick a voice or record your own, and get a vertical video with captions, a title and music, ready to post.

- Product & technical spec: [docs/SPEC.md](docs/SPEC.md)
- Visual design ("Ember"): [docs/design/ember/](docs/design/ember/) — the designer's handoff. Open `Instant Vlog Clip.dc.html` through a local web server (for example `npx serve docs/design/ember`) to click through the prototype.
- Current screens: [docs/screens/](docs/screens/) (phone and desktop, every state; regenerate with `node e2e/screens.mjs`)
- Original design brief: https://claude.ai/artifact/CKXX2gxRcFGYCesEh495UG (source in [docs/design-handoff/](docs/design-handoff/))

## Quick start (no accounts needed)

```bash
npm install
npm run dev          # http://localhost:5173
```

The app runs in **demo AI mode** by default (`VITE_AI_MODE=mock`): clip analysis, script writing, the edit planner and the AI voice are simulated in the browser, so every screen works without API keys. Demo voices are a soft murmur timed to the words.

Use the latest Chrome, Edge or Safari. Video decoding and encoding use WebCodecs.

## Live AI mode

Live mode sends requests to one Supabase Edge Function (`supabase/functions/ai`). It uses a language model for clip analysis, scripts and edit plans, and **ElevenLabs** for the AI voice and speech-to-text. Users' video files never leave their device; only small contact-sheet images, short audio and text are sent.

The language model is a setting (`AI_PROVIDER`):
- **`gemini`** (default): Google Gemini. Get a key at Google AI Studio. The free tier is fine for development, but its limits are low, and Google may use free-tier requests to improve its products. **Switch the key to a paid (billing-enabled) Google account before launch.**
- **`claude`**: Anthropic Claude (`claude-opus-5-5`), with an Anthropic API key.

Nothing else changes between them: same prompts, same response formats, same app. Gemini additionally gets a short checklist at the end of each request (allowed clip IDs, exact scene lengths, word budget) and stricter response limits, since faster models follow rules better when they're restated with the real numbers.

**Testing the AI before wiring up the app:** `scripts/ai-smoke.ts` runs the script writer and edit planner on a sample day and lists any rule the answers break (length, hook/outro, scene timing, unknown or unusable clips). Pass a JPEG contact sheet to test clip analysis too.
```bash
GEMINI_API_KEY=... deno run -A scripts/ai-smoke.ts [contact-sheet.jpg]
```

1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Apply the database migration (usage limits):
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```
3. Set the function's secrets and deploy it:
   ```bash
   # Gemini (default)
   supabase secrets set GEMINI_API_KEY=... ELEVENLABS_API_KEY=...
   # or Claude
   supabase secrets set AI_PROVIDER=claude ANTHROPIC_API_KEY=... ELEVENLABS_API_KEY=...
   supabase functions deploy ai
   ```
   Optional secrets: `GEMINI_MODEL` (default `gemini-flash-latest`, which follows Google's current Flash model; pin a version for launch), `ALLOWED_ORIGIN` (your site URL, for CORS), `QUOTAS_DISABLED=true` (local testing), and the limits `USER_GENERATIONS_PER_DAY` (10), `USER_REVISIONS_PER_DAY` (60), `GUEST_GENERATIONS_TOTAL` (1), `GUEST_REVISIONS_TOTAL` (5), `IP_GUEST_GENERATIONS_PER_DAY` (3), `CALLS_PER_DAY` (500).
4. In Supabase Auth, enable email sign-in (and Google if wanted), and add your site URL to the redirect URLs.
5. Create `.env.local` from `.env.example`:
   ```
   VITE_AI_MODE=live
   VITE_SUPABASE_URL=https://<your-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   VITE_AUTH_GOOGLE=false
   ```

Signed-out visitors get one free vlog (tracked per device and IP), then are asked to sign in.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build into `dist/` |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test-clips` | Generates test videos into `e2e/fixtures` (needs ffmpeg) |
| `npm run e2e` | Browser tests against a running dev server (Playwright Chromium) |
| `node e2e/screens.mjs` | Re-captures the designer handoff screenshots |

Playwright's Chromium has no H.264 decoder, so test clips are VP9/WebM and exports in tests come out as WebM. Real Chrome and Safari export MP4 (H.264/AAC).

## How it works

```
Add clips ──► on device: metadata, thumbnail, quality signals, contact sheet
                 │
                 ▼ (in the background while the user writes)
            AI clip analysis (description, tags, best moments, focus point)
                 │
Script ─────► AI writes or polishes first-person lines grounded in the clips
Voice  ─────► AI voice per line, or the user's recordings (trimmed, levelled, word-timed)
                 │
Generate ──► AI edit planner → Edit Decision List (JSON) → validate & repair → fallback if needed
                 │
Edit ──────► real-time canvas preview, scene cards, "Tell the AI", undo
Export ────► WebCodecs + Mediabunny, frame-accurate, on device → MP4/WebM → share sheet
```

The **edit plan** ([src/domain/types.ts](src/domain/types.ts)) is the single source of truth. The AI only proposes one; [src/domain/repair.ts](src/domain/repair.ts) clamps it to real clip bounds, makes each scene exactly cover its narration line, removes repeated footage and fills gaps, and [src/domain/fallback.ts](src/domain/fallback.ts) builds a rule-based edit when the AI is unavailable. The preview and the exporter share one compositor ([src/render/compositor.ts](src/render/compositor.ts)), so what you see is what you export.

### Layout

```
src/
  domain/     edit plan types, timing, repair, fallback planner, timeline (pure, unit-tested)
  media/      probing, on-device signals & contact sheets, audio decode/encode
  ai/         AI service interface, demo (mock) and live providers, catalog builder
  pipeline/   background clip analysis, voicing, generation orchestration
  render/     compositor, preview player, audio mix, music, styles, export
  features/   screens: home, clips, script, voice, generate, edit, export, auth
  store/      the open project (Zustand), saved to IndexedDB
  lib/        IndexedDB, on-device media store (OPFS/IndexedDB), Supabase client
supabase/
  functions/_shared/  contracts, prompts and JSON schemas shared with the app
  functions/ai/       Edge Function: Claude + ElevenLabs + usage limits
  migrations/         usage counters
e2e/          Playwright flows and the screenshot script
```

All project data lives in the browser (IndexedDB + Origin Private File System). Nothing is synced between devices yet.

## Design notes

The UI follows the Ember handoff: tokens live in [src/index.css](src/index.css), base components in [src/components/ui/](src/components/ui/). Where the build differs from the prototype, on purpose:
- **One compositor for preview and export.** The title sits at 15% and captions at 70% of the frame (the export spec) in the preview too, so what you see is exactly what you export. The prototype's preview used 11% / 66%.
- **Dark theme only.** The light theme isn't designed yet.
- **Icons** are Lucide at 2.2–2.6px stroke rather than the prototype's hand-drawn SVGs.
- **"Save to Photos"** on phones downloads the file; browsers can't write to the photo library directly. **Share** opens the native share sheet, where users can pick Photos.

## Status and known gaps

Built and verified in Chromium with the demo AI: the full flow (import → script → AI voice → generate → edit → export), own-voice recording with a fake microphone, the no-script montage, reload persistence and unreadable-file handling. Unit tests cover the edit-plan logic and the demo AI.

Not yet verified:
- **Live AI has not been run against real APIs.** This build environment couldn't reach Google, Anthropic or ElevenLabs. The Gemini and Claude calls follow their official SDKs (the Gemini request shape was checked against the SDK with a stubbed network); the ElevenLabs endpoints (`/v1/text-to-speech/{voice}/with-timestamps`, `/v1/speech-to-text` with `scribe_v1`) and the six voice IDs in [contracts.ts](supabase/functions/_shared/contracts.ts) should be checked against ElevenLabs' docs on first deploy. Prompts will need tuning with real footage.
- **Real devices.** Not yet tested on a physical iPhone or Android phone, or with large 4K/HEVC phone clips.

Not built yet (see spec):
- ffmpeg.wasm fallback for codecs the browser can't decode (those clips currently show an error on their tile).
- A licensed music library. The five tracks are generated placeholders ([src/render/musicTracks.ts](src/render/musicTracks.ts)); give a track a `url` to use a real file.
- Export runs on the main thread (WebCodecs does the heavy work off-thread). Move it to a worker if the UI stutters on slower phones.
- P1 features: photos, beat-synced cuts, per-frame subject tracking, templates, cloud sync, more languages.
