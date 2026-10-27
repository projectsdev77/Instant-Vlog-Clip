# Instant Vlog Clip

Turn raw phone footage into a short, narrated vlog. Add clips, write a few lines (or let AI write them), pick a voice or record your own, and get a vertical video with captions, a title and music, ready to post.

- Product & technical spec: [docs/SPEC.md](docs/SPEC.md)
- Going live (Stripe, paid AI plans, domain, legal): [docs/GO_LIVE.md](docs/GO_LIVE.md); step by step in [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)
- Testing (automated and manual): [docs/TESTING.md](docs/TESTING.md)
- Visual design ("Ember"): [docs/design/ember/](docs/design/ember/) — the designer's handoff. Open `Instant Vlog Clip.dc.html` through a local web server (for example `npx serve docs/design/ember`) to click through the prototype.
- Current screens: [docs/screens/](docs/screens/) (phone and desktop, every state; regenerate with `node e2e/screens.mjs`)
- Original design brief: https://claude.ai/artifact/CKXX2gxRcFGYCesEh495UG (source in [docs/design-handoff/](docs/design-handoff/))

## Quick start

The app always uses the real AI, so it needs your Supabase project and AI keys (set up below) before it can write scripts, voice lines or make edits.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and anon key
npm run dev                   # http://localhost:5173
```

Use the latest Chrome, Edge or Safari. Video decoding and encoding use WebCodecs.

## AI setup

The app sends requests to one Supabase Edge Function (`supabase/functions/ai`). It uses a language model for clip analysis, scripts and edit plans, and **ElevenLabs** for the AI voice and speech-to-text. Users' video files never leave their device; only small contact-sheet images, short audio and text are sent.

The language model is a setting (`AI_PROVIDER`):
- **`gemini`** (default): Google Gemini (Flash-Lite by default, see the secrets below). Get a key at Google AI Studio. The free tier is fine for development, but its limits are low, and Google may use free-tier requests to improve its products. **Switch the key to a paid (billing-enabled) Google account before launch.**
- **`claude`**: Anthropic Claude (`claude-opus-5-5`), with an Anthropic API key.

Nothing else changes between them: same prompts, same response formats, same app. Gemini additionally gets a short checklist at the end of each request (allowed clip IDs, exact scene lengths, word budget) and stricter response limits, since faster models follow rules better when they're restated with the real numbers.

**Testing the AI before wiring up the app:** `scripts/ai-smoke.ts` runs the script writer and edit planner on a sample day and lists any rule the answers break (length, hook/outro, scene timing, unknown or unusable clips). Pass a JPEG contact sheet to test clip analysis too.
```bash
GEMINI_API_KEY=... deno run -A scripts/ai-smoke.ts [contact-sheet.jpg]
```

1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Apply the database migrations (usage limits and subscriptions):
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
   supabase functions deploy account
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
   Optional secrets: `GEMINI_MODEL` (script and edit plan) and `GEMINI_FAST_MODEL` (polish and clip analysis), both defaulting to `gemini-flash-lite-latest`, Google's fastest model (regular Flash took 1–2 minutes per request on a free-tier key); try `gemini-flash-latest` for the script and plan once billing is on. Each call's model and duration are in the function logs, `ALLOWED_ORIGIN` (your site URL, for CORS), `QUOTAS_DISABLED=true` (local testing), and the limits `FREE_GENERATIONS_PER_DAY`, `FREE_REVISIONS_PER_DAY`, `PRO_GENERATIONS_PER_DAY`, `PRO_REVISIONS_PER_DAY` (defaults in [plans.ts](supabase/functions/_shared/plans.ts)), `GUEST_GENERATIONS_TOTAL` (1), `GUEST_REVISIONS_TOTAL` (5), `IP_GUEST_GENERATIONS_PER_DAY` (3), `CALLS_PER_DAY` (500).
4. In Supabase Auth, enable email sign-in (and Google), and add your site URL to the redirect URLs ([SETUP_GUIDE](docs/SETUP_GUIDE.md) C and I).
5. Create `.env.local` from `.env.example`:
   ```
   VITE_SUPABASE_URL=https://<your-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   VITE_AUTH_GOOGLE=false
   ```

Signed-out visitors get one free vlog (tracked per device and IP), then are asked to sign in. Signed-in users get the Free plan's daily limits; Pro (Stripe subscription) raises them. Prices, trial and limits are placeholders in [plans.ts](supabase/functions/_shared/plans.ts). Payments stay off until the Stripe secrets are set (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`); see [docs/GO_LIVE.md](docs/GO_LIVE.md).

## Deploying (Vercel + Supabase)

The website is static and goes on Vercel; the AI keys stay on the server side in Supabase.

**Never put API keys in a `VITE_` variable.** Vite copies every `VITE_` value into the JavaScript that browsers download.

| Where | Variables |
|---|---|
| Vercel → Project → Settings → Environment Variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public values) |
| Supabase → Edge Functions → Secrets (or `supabase secrets set`) | `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, optional `AI_PROVIDER`, `GEMINI_MODEL`, `ALLOWED_ORIGIN`, limits, and the four `STRIPE_*` secrets |

`vercel.json` sends every route to `index.html`, so links like `/p/<id>/edit` work on refresh. Set `ALLOWED_ORIGIN` to your Vercel URL so only your site can call the AI function.

**Running live mode on your computer:** put the three `VITE_` values in `.env.local`, and the secrets in `supabase/functions/.env` (add `QUOTAS_DISABLED=true` there to skip usage limits while developing). Then:
```bash
supabase functions serve --env-file supabase/functions/.env
npm run dev
```
Both `.env` files are git-ignored.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build into `dist/` |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | Browser tests (Playwright Chromium). Starts a stand-in AI and its own dev server on port 5179; no keys needed. `npm run e2e -- flow lines` runs some suites. See [docs/TESTING.md](docs/TESTING.md) |
| `npm run test:all` | Lint, typecheck, unit tests and browser tests |
| `npm run test-clips` | Regenerates the test videos in `e2e/fixtures` (needs ffmpeg) |
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
Voice  ─────► AI voice per line, own voice (recorded after Make), or captions only
                 │
Generate ──► AI edit planner → Edit Decision List (JSON) → validate & repair → fallback if needed
                 │
Record ────► own voice only: record over the made vlog (takes, levelled, transcribed)
Edit ──────► scene strip, real-time canvas preview, Scene/Look/Voice/Music/Text tabs, Ask AI, versions
Export ────► WebCodecs + Mediabunny, frame-accurate, on device → MP4/WebM → share sheet
```

**Length.** The user picks it on the Clips step (Auto, 15, 30 or 60 s). Each narration line gets a scene exactly as long as the line; the rest of the length is footage-only scenes (the clips' own sound under the music), spread between the lines. A chosen length wins (the weaker clips are left out), starred clips always appear, and speech is never cut. **Use every clip** on the Clips step shows every good clip even past the length. Auto means the narration plus about one shot per clip it doesn't cover, or, with no script, a length that fits the footage.

**Own voice ("Record my own").** Choosing it on the Voice step adds a sixth step: Make builds the vlog first (scenes timed to reading the lines), then the **Record** page plays the made vlog while the user talks, with the current script line shown above it as a guide (never as a caption). One long take or many short ones, from any point. Takes sit on a track under the scenes: drag to move, drag the edges to trim, split at the playhead, re-record, delete, set the volume; where takes overlap the newer one wins. Takes stay at their times when the edit changes later. Once a voice is recorded, Ask AI keeps the current scene timing and doesn't rewrite the lines. Captions come from what the user actually said (speech-to-text of each take), so it also works with no script. Two ways to record: **Read my script** (the lines show above the video as a guide and stay as written) or **Say my own thing** (the default with no script): as each take's captions arrive, the words said in each recorded part become that part's line and its footage is re-matched to them, at the same length ([scriptFromSpeech](src/domain/voiceTrack.ts), [src/features/voice/followVoice.ts](src/features/voice/followVoice.ts)). The lines are only a guide there: each can be changed (with new footage that suits the words, or keeping the footage) or removed (its part stays, as footage only), and a new line can be added at the playhead (a footage-only part takes it; a part with a line is split). Scene lengths never change, so recorded takes stay in place; footage is matched on device against the AI's clip descriptions ([src/domain/pickFootage.ts](src/domain/pickFootage.ts)). "Continue to edit" (or "Skip for now") goes on to Edit; the Voice panel there opens the studio again ([src/features/voice/RecordStep.tsx](src/features/voice/RecordStep.tsx), [src/features/voice/VoiceStudio.tsx](src/features/voice/VoiceStudio.tsx), [src/domain/voiceTrack.ts](src/domain/voiceTrack.ts)).

**The Edit screen** (from the "Edit Inspector" design handoff). A **scene strip** runs across the top: tile width follows each scene's length (fixed on phones), music-only scenes get a note badge, drag (long-press on touch) or Alt+←/→ reorders, and the + tile adds a scene with an unused good moment ([SceneStrip.tsx](src/features/edit/SceneStrip.tsx)). The preview sits on the left with the **Ask AI** card under it (desktop; a bottom bar and sheet on phones); undo, redo, a **Versions** menu (saved checkpoints, see below) and Export are in the header. The right panel has five tabs:
- **Scene** ([SceneTab.tsx](src/features/edit/SceneTab.tsx)): previous/next, duplicate scene (the copy has no line), delete; *What's said* (empty = a music-only moment) with the AI voice's Read it (Natural, Calmer, Energetic, Slower), Read again and Mute voice; *Clip*: a shot switcher when a scene has several, a filmstrip trim with two handles (snaps to 0.1 s, arrow keys work), Split at the playhead (or in half), Freeze at the playhead or Hold last frame, swap for another good moment; *Motion*: four options each for speed, camera and transition, the rest (3×, Montage, Hero, Bullet, Pan left, Punch, Shake, Dip, Slide, Flash, Blur) under **More**; *Clip sound* Off/Quiet/Full with the clip volume; *Frame*: As in Look, Fill or Blurred edges for this shot.
- **Look**: template cards, filter thumbnails (of the current scene) with Strength, and *Fine-tune* (six sliders, Frame, fades, letterbox).
- **Voice**: AI voice / My own voice / No voiceover (a switch is explained first), voices with a play preview, voice level; own voice links to the voice studio.
- **Music**: tracks with a play preview, music level, and *Use your own song* (rights checkbox, start point).
- **Text**: title and when it shows; caption styles including **No captions**.

**Ask AI** ([askAi.ts](src/features/edit/askAi.ts)). The request goes to the AI with the vlog as it is now (scenes in order with refs `s1`, `s2`…, their lines, shots and effects, the look, music, captions, title, length, voice) plus the clip catalog and the last three exchanges. The AI (`edit-request`, [prompts.ts](supabase/functions/_shared/prompts.ts) `EDIT_SYSTEM`) answers with a short reply and a list of exact changes (move, delete, duplicate or add a scene; swap footage; speed, camera, transition, clip sound and volume, frame, freeze; rewrite, add, remove, re-read or mute a line; voice; filter and adjustments, letterbox, fades, template; music and level; caption style; title; length). The app checks each one and applies it with the same tools as the panels, so nothing that wasn't asked for moves; changes that make no sense are skipped. All of them become **one undo step** (and a saved version of what was there before is made first), which also keeps the vlog-wide settings (music, captions, title, voice, length) so Undo brings those back too. When an answer would change something the user changed by hand in a scene (its footage, effects, sound or words), a **Keep your changes?** pop-up asks first: **Keep my changes** (the rest still happens) or **Let AI change them**, with **Don't ask again for this vlog** (undone with "Ask me each time" under the Ask AI box). Changes that touch other parts of that scene go ahead without asking ([handEdits.ts](src/domain/handEdits.ts)). If the AI can't do something or isn't sure what's meant, it says so (or asks one question) and nothing is saved; the reply shows under the box (a toast on phones). Rewritten lines are voiced again with the AI voice. The suggestion chips are made from the user's own footage (clip tags), with no AI call.

Slider drags are saved as one undo step per pause ([editActions.ts](src/features/edit/editActions.ts) `commitMerged`). The video title is drawn as one balanced block.

**Music.** Platform music libraries (TikTok, CapCut, Instagram, Snapchat) are licensed for use inside those apps only, so an exported video can't carry them. The app offers: built-in tracks (today placeholders generated in the browser; give a track a `url` in [musicTracks.ts](src/render/musicTracks.ts) and put the file in `public/music` once you have rights to bundle it and to use it in users' exported videos; CC0 or commissioned music fits, Mixkit's and Pixabay's terms don't clearly allow bundling a library); **Your own music** in Edit's Music panel (after the user confirms they have the rights; choose where the song starts; it loops if shorter and fades out); and **Include the music** in Export, so people can add a trending sound inside TikTok, Instagram or YouTube instead. Music always dips under speech.

**Account storage** ([src/cloud/](src/cloud/), [migration](supabase/migrations/20261027000000_vlog_storage.sql)). Signed in, each vlog is saved to the account a few seconds after every change (and when the tab is hidden): the draft (current edit, saved versions, script, clip details and thumbnails, no undo history) as a row in the `vlogs` table, and the voice audio, the user's own song and the latest finished video (uploaded after each export) in a private `vlogs` bucket under `<user id>/<vlog id>/`. Original clips are never uploaded. Home lists the account's vlogs too ("In your account" on ones not on this device yet); opening one brings it here, and its clips show as "not on this device" until the user adds them again (matched by name and size, keeping the AI's notes) ([relink.ts](src/features/clips/relink.ts)). If two devices changed the same vlog, the newer copy wins and the other is kept in Versions ([draft.ts](src/cloud/draft.ts)). Each plan's space is in the `storage_limits` table (Free 2 GB, Pro 50 GB); when it's full, finished videos stay on the device and nothing is deleted. Vlogs made before signing in move into the account on sign-in; another account's vlogs on the same browser are left alone. Deleting a vlog or the account removes it from the account too. Signed out, everything stays in the browser as before. Accounts: sign up with email and password (confirmed by an emailed link) or Google; log in the same way; forgot password emails a link to `/reset-password` ([AuthForm.tsx](src/features/auth/AuthForm.tsx), [AuthPages.tsx](src/features/auth/AuthPages.tsx)).

**Protecting the user's work.** Undo / redo step through every change (up to 50) and restore the scenes *and* the script. **Versions** work like Figma's version history ([versions.ts](src/features/edit/versions.ts), [VersionMenu.tsx](src/features/edit/VersionMenu.tsx)): the list only holds checkpoints of the whole vlog (scenes, script, music, captions, title, voice, length), saved automatically as "First edit" when Edit first opens, after each editing session (3 quiet minutes, the tab hidden, or leaving Edit), before each Ask AI change and after an export, plus **Save version** with an optional name. Restoring one saves what's there first ("Before restoring a version") and comes back as an undo step. Up to 30 automatic versions are kept; named ones always stay. Each scene remembers what the user changed by hand (footage, effects, sound, words), so Ask AI can ask before changing those again. The same button locks or unlocks any scene by hand. Switching the narration in Edit first says what will change (captions, timing, kept takes). Recording starts after a 3-2-1 countdown that shows the mic level. If the browser can't encode video, Clips and Edit say so before any editing. Home says vlogs are kept in this browser only; Clips says what the AI services receive. A vlog's ••• menu on Home has **Download a backup** (one `.vlogbackup` file: clips, voice, takes, every version) and Home has **Open a backup**, which adds it back as a new vlog on any device ([src/pipeline/backup.ts](src/pipeline/backup.ts)). The AI starts looking at clips on the Clips step; each clip is tried up to three times on its own (after 3 s and 10 s) when the AI is busy or unreachable; a clip it still couldn't look at shows "AI missed it · retry", and Continue says so in a pop-up first (Try again / Continue anyway). A clip that would take the footage past 10 minutes stays on the grid with the reason. Make has a Cancel button, and leaving the page lets it finish and save quietly. Takes can be moved and trimmed with the keyboard (arrows, Alt/Ctrl + arrows, Delete).

**First-visit tutorial.** On a first visit the home page opens a five-slide intro ("How it works", also in the header to see again). It ends with **Try it with sample clips** (starts a vlog with the three example videos from `public/examples`) or **Use my own clips**. Either way, a tip then points at the key control on each step (12 on the AI-voice path: choose clips, star, length, write it for me, template, voice, make, preview, scenes, look, Ask AI, export; own voice adds two on the Record page: script or own words, and Record). Tips don't block the page; doing what a tip points at counts as done, and "Skip tutorial" turns them off. Progress is kept in this browser ([src/features/tutorial/](src/features/tutorial/)).

**Templates and effects (CapCut-style, AI-driven).** The user picks a template on the Script step (Day in my life, TikTok fast cuts, Cinematic, Travel diary, Aesthetic, Clean) and can switch it on the Edit screen's Look tab. A template ([src/domain/templates.ts](src/domain/templates.ts)) sets the color look, caption style, pacing and which transitions (cut, fade, dip, whip, slide, zoom, flash, blur), camera moves (zoom in/out, pan, punch, shake) and speed effects (0.5–3×, speed ramps) the AI editor may use. The AI picks effects per shot to fit the footage; then `stylize()` keeps its allowed choices, tops up to the template's style, and lands footage-only cuts on the music's beat. Users can change any of it per shot (split, freeze frame, duplicate, delete, speed, camera, transition, fill or blurred background, clip volume) and for the whole vlog (filters, brightness/contrast/saturation/warmth, vignette, grain, fades). Every change is a new version with undo.

The **edit plan** ([src/domain/types.ts](src/domain/types.ts)) is the single source of truth. The AI only proposes one; [src/domain/repair.ts](src/domain/repair.ts) clamps it to real clip bounds, makes each scene exactly cover its narration line, removes repeated footage and fills gaps, and [src/domain/fallback.ts](src/domain/fallback.ts) builds a rule-based edit when the AI is unavailable. The preview and the exporter share one compositor ([src/render/compositor.ts](src/render/compositor.ts)), so what you see is what you export.

### Layout

```
src/
  domain/     edit plan types, timing, repair, fallback planner, timeline (pure, unit-tested)
  media/      probing, on-device signals & contact sheets, audio decode/encode
  ai/         AI service (calls the Edge Function), catalog builder
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

The full flow (import → script → AI voice → generate → edit → export), own voice recorded on the Record page with a fake microphone, the per-line voice tools, the no-script montage, reload persistence and unreadable-file handling were verified in Chromium. The browser tests run against a stand-in for the AI ([e2e/stub-ai.mjs](e2e/stub-ai.mjs)) on every push (GitHub Actions). Unit tests cover the edit-plan logic (fitting, repair, fallback edit, templates).

Not yet verified:
- **Live AI has not been run against real APIs.** This build environment couldn't reach Google, Anthropic or ElevenLabs. The Gemini and Claude calls follow their official SDKs (the Gemini request shape was checked against the SDK with a stubbed network); the ElevenLabs endpoints (`/v1/text-to-speech/{voice}/with-timestamps`, `/v1/speech-to-text` with `scribe_v1`) and the voice list (`GET /v1/voices`: the app offers the voices added to the ElevenLabs account, else the built-in default voices in [contracts.ts](supabase/functions/_shared/contracts.ts), which ElevenLabs retires on December 31, 2026; see [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md#l-ai-voices)) should be checked against ElevenLabs' docs on first deploy. Prompts will need tuning with real footage.
- **Payments have not been run against Stripe.** The checkout, portal and webhook functions type-check and the pages were tested against a stand-in; run the Stripe test-mode steps in [docs/GO_LIVE.md](docs/GO_LIVE.md) first.
- **Terms and Privacy are drafts** with [bracketed] placeholders and need a lawyer's review.
- **Real devices.** Not yet tested on a physical iPhone or Android phone, or with large 4K/HEVC phone clips.

Not built yet (see spec):
- ffmpeg.wasm fallback for codecs the browser can't decode (those clips currently show an error on their tile).
- **Home page example videos** ([public/examples/](public/examples/)), including the two "What you get" tiles (`vlogger`, `cafe-selfie`: Mixkit #46352 and #8784, 12 s, 720p), are cut from Mixkit free stock footage (Mixkit License: free for commercial use, no attribution). Confirm the license, or swap in the client's own footage, before launch. Each is a 7.8 s, 360×640 WebM + MP4 + poster JPG; the front card's captions are in [covers.ts](src/features/home/covers.ts).
- A licensed music library. The five tracks are generated placeholders ([src/render/musicTracks.ts](src/render/musicTracks.ts)); give a track a `url` to use a real file.
- Export runs on the main thread (WebCodecs does the heavy work off-thread). Move it to a worker if the UI stutters on slower phones.
- P1 features: photos, beat-synced cuts, per-frame subject tracking, templates, cloud sync, more languages.
