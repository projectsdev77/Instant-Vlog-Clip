# Instant Vlog Clip

Turn raw phone footage into a short, narrated vlog. Add clips, write a few lines (or let AI write them), pick a voice or record your own, and get a vertical video with captions, a title and music, ready to post.

- Product & technical spec: [docs/SPEC.md](docs/SPEC.md)
- Designer handoff: https://claude.ai/artifact/CKXX2gxRcFGYCesEh495UG (source and screenshots in [docs/design-handoff/](docs/design-handoff/))

## Quick start (no accounts needed)

```bash
npm install
npm run dev          # http://localhost:5173
```

The app runs in **demo AI mode** by default (`VITE_AI_MODE=mock`): clip analysis, script writing, the edit planner and the AI voice are simulated in the browser, so every screen works without API keys. Demo voices are a soft murmur timed to the words.

Use the latest Chrome, Edge or Safari. Video decoding and encoding use WebCodecs.

## Live AI mode

Live mode sends requests to one Supabase Edge Function (`supabase/functions/ai`), which calls **Claude** (clip analysis, scripts, edit plans) and **ElevenLabs** (AI voice, speech-to-text). Users' video files never leave their device. Only small contact-sheet images, short audio and text are sent.

1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Apply the database migration (usage limits):
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```
3. Set the function's secrets and deploy it:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=... ELEVENLABS_API_KEY=...
   supabase functions deploy ai
   ```
   Optional secrets: `ALLOWED_ORIGIN` (your site URL, for CORS), `QUOTAS_DISABLED=true` (local testing), and the limits `USER_GENERATIONS_PER_DAY` (10), `USER_REVISIONS_PER_DAY` (60), `GUEST_GENERATIONS_TOTAL` (1), `GUEST_REVISIONS_TOTAL` (5), `IP_GUEST_GENERATIONS_PER_DAY` (3), `CALLS_PER_DAY` (500).
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

## Status and known gaps

Built and verified in Chromium with the demo AI: the full flow (import → script → AI voice → generate → edit → export), own-voice recording with a fake microphone, the no-script montage, reload persistence and unreadable-file handling. Unit tests cover the edit-plan logic and the demo AI.

Not yet verified:
- **Live AI has not been run against real APIs.** This build environment couldn't reach Anthropic or ElevenLabs. The Claude calls follow the current SDK; the ElevenLabs endpoints (`/v1/text-to-speech/{voice}/with-timestamps`, `/v1/speech-to-text` with `scribe_v1`) and the six voice IDs in [contracts.ts](supabase/functions/_shared/contracts.ts) should be checked against ElevenLabs' docs on first deploy. Prompts will need tuning with real footage.
- **Real devices.** Not yet tested on a physical iPhone or Android phone, or with large 4K/HEVC phone clips.

Not built yet (see spec):
- ffmpeg.wasm fallback for codecs the browser can't decode (those clips currently show an error on their tile).
- A licensed music library. The five tracks are generated placeholders ([src/render/musicTracks.ts](src/render/musicTracks.ts)); give a track a `url` to use a real file.
- Export runs on the main thread (WebCodecs does the heavy work off-thread). Move it to a worker if the UI stutters on slower phones.
- P1 features: photos, beat-synced cuts, per-frame subject tracking, templates, cloud sync, more languages.
