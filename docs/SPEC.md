# Autovlog (Instant Vlog Clip) — Product & Technical Spec

**Status:** Draft v0.2 · **Date:** 2026-10-08
**Client brief (verbatim):** "Turn raw footage into polished vlog videos automatically. User adds clips, maybe a quick script with AI — then mini-vlog created based on clips and script."
**Reference:** https://instant-vlog-creator.lovable.app, the client's Lovable landing page (reviewed 2026-10-08, findings in §2; screenshots in [docs/reference/](reference/)).

Everything beyond the brief and the landing page is a product decision made in this document. Decisions are marked **[D]** so they're easy to find and override.

> **v0.2 changes:** reviewed the landing page. **Voiceover** (AI or your own voice) and **multiple languages** moved from P1 into the MVP, because the page promises them. The script is now narration-first. Added the landing page's visual style, a working waitlist (the current one discards signups) and a name question.

---

## 1. Product in one paragraph

Autovlog is a web app that turns a pile of phone clips into a short, narrated, shareable vlog in about a minute. The user drops in their clips and writes a few bullet points about their day, or lets AI write them. The app turns those into a short first-person script, voices it (AI voice, or the user records their own), picks the best moments from each clip, cuts them to the narration, adds synced captions, a title and music, and exports a ready-to-post vertical MP4. The user can tweak the result (reorder, trim, edit lines, swap music or voice) but never has to touch a timeline.

## 2. What the client's landing page promises

The landing page is a marketing site with a waitlist. There's no app mock yet. Its promises to users are the product's real requirements, so every claim is mapped below.

| Landing page says | What we build | Where |
|---|---|---|
| "Turn your clips into a vlog, instantly" / "Ready in 60 seconds" | Background clip analysis + fast pipeline; target **< 60 s** from Generate to preview | §4.3, §8 |
| "Upload your clips: select videos from your messy phone gallery" | Mobile-first picker, handles lots of mixed clips, auto-discards junk shots | §4.1, §5.1 |
| "Add your script: write your story or let AI generate it" | Bullet-point script editor + "Write it for me" | §4.2, §5.2 |
| "Voiceover included: AI-generated or record your own voice" | AI voices (TTS) **and** in-app voice recording, in the **MVP** | §4.2, §5.3 |
| "AI Magic, Auto Edit: cuts, captions, and adds music" | Edit planner + word-synced captions + music with ducking | §5.4, §5.5 |
| "Captions & music auto-synced" | Captions timed to the narration word by word; music ducks under voice | §5.5 |
| "Perfect for TikTok, Reels, and Shorts" | 9:16 by default, safe-zone-aware caption placement, 1080×1920 export | §4.5, §5.5 |
| "Multiple languages: 20+" | Script, voice and captions in the user's chosen language, in the **MVP** | §5.6 |
| "Works with your footage" (vs Pictory/InVideo stock footage) | No stock footage; your clips only | §9 |
| "Made for creators" (vs Visla corporate) | Casual, personal, first-person tone and styles | §2a, §5.2 |
| "Instant AI editing" (vs CapCut/Adobe Rush "too manual") | No timeline; scene cards + "Tell the AI" | §4.4 |
| Price "0", "No credit card required" | Free at launch; monetization TBD | §11 |

**Visual mockups on the page** set the expected look of the output:
- A big bold **title at the top** of the frame ("TRIP TO PARIS", "MY DAY IN NYC")
- **Subtitle-style captions** in the lower third showing the narration ("So I arrived in Paris yesterday…")
- A **voice waveform** motif
- The script mock shows **first-person bullet points** ("I woke up early and grabbed coffee." / "I biked through the park." / "Met Sam for lunch.") and a **Generate VO** button with a mic icon

**Issues found on the landing page** (to fix with the client):
1. **The waitlist doesn't save anything.** The form waits 1.5 s, shows "You're on the list! 🎉" and discards the name and email. Every signup so far is lost. Fixed in M0 (§10).
2. **The name isn't settled.** The page says **Autovlog**, but its title and meta tags say **Autoroll** with domain autoroll.ai, and the repo is "Instant Vlog Clip". This spec uses *Autovlog* until the client confirms (§11).
3. The "Complete Solution" image shows a dark, pro multi-track timeline editor, which contradicts the "no manual editing" pitch. It should be replaced with a real product screenshot once we have one.
4. Footer says © 2024 and lists a placeholder-looking contact email.

## 2a. Who it's for

**Primary user:** casual creators (travellers, students, small-business owners, "day in my life" posters) who film a lot on their phone and never edit it. They post to Instagram Reels, TikTok and YouTube Shorts.

They are **not** professional editors. They want a good-looking, narrated result fast, with a couple of simple knobs.

**Jobs to be done**
1. "I filmed my day/trip and want to post a 'day in my life' with narration today."
2. "I know what I want to say. Make my clips match it."
3. "I want it to look and sound like I spent an hour editing."

## 3. Product principles

1. **Instant first, perfect second.** The first result arrives without decisions. Every option has a good default.
2. **The narration is the spine.** The vlog is a short first-person story, voiced, and the clips are cut to it. That's what separates it from a highlights montage.
3. **Edit by talking, not by timeline.** Tweaks happen on scene cards and through plain-language feedback ("make it faster", "start with the beach").
4. **Your footage stays yours.** Raw video never leaves the device. Only small preview frames and speech audio are sent for AI analysis. **[D]**
5. **Mobile-first web.** The footage lives on phones, so the full flow must work in a phone browser.

## 4. Core user flow

```
Add clips → Add your script (write / AI / skip) → Pick a voice → Generate → Preview & tweak → Share
```

This mirrors the landing page's four steps: Upload → Script → AI Magic → Share.

### 4.1 Upload your clips
- Drag-and-drop on desktop; native picker on mobile (camera-roll access).
- Accepts MP4, MOV (incl. iPhone HEVC), WebM. Photos are P1.
- **[D] Limits (MVP):** up to 30 clips, 10 min total footage, 4 GB total, with a clear message if exceeded.
- Thumbnails appear immediately. Analysis starts in the background while the user writes the script, so Generate feels instant.
- "Messy gallery" handling: accidental recordings, pocket shots and near-duplicates are detected and quietly deprioritized (§5.1). The user can remove clips or star them as **Must include**.

### 4.2 Add your script
One screen, modeled on the landing page mock:

- **Title** field (e.g. "My Day in NYC"). AI suggests one if left blank. Shown as the on-screen title.
- **Script box** with bullet points, first person, one line per moment. Placeholder: *"I woke up early and grabbed coffee."*
- Buttons:
  - **✨ Write it for me**: AI drafts bullets from the clips (and an optional one-line prompt like "chill Sunday in Lisbon"). It only describes things that are actually in the footage.
  - **Polish**: AI rewrites the user's own bullets into natural spoken narration, keeping their meaning and voice.
  - **Skip narration**: music + title + text captions only, no voice.
- **Settings chips** with defaults:
  - Language: auto-detected from the browser, changeable (§5.6) **[D]**
  - Format: **9:16** (default) · 1:1 · 16:9 **[D]**
  - Length: **Auto** (fits the narration, typically 20–60 s) · 15s · 30s · 60s **[D]**
  - Vibe: **Auto** · Chill · Upbeat · Cinematic · Funny · Aesthetic. Drives music and cut pace. **[D]**

### 4.3 Pick a voice & generate
- **Voice:** a short list of AI voices (male/female, a few styles; tap to preview a line of *their* script) **or 🎙 Record my own**.
  - Record mode shows a teleprompter: one line at a time, tap to record, re-record any line. Each line is a separate take, so mistakes are cheap to fix.
- **Generate:** a progress screen with honest stages: *Watching your clips → Voicing your script → Picking the best moments → Cutting it together → Adding captions & music.*
- Target: **under 60 s** from Generate to playable preview (10 clips, ~3 min footage, recent phone or laptop). This matches the "ready in 60 seconds" promise.

### 4.4 Preview & tweak
Layout: phone-shaped player on top, **scene strip** below, with one card per script line in order.

Each **scene card** lets you:
- Edit the line. Only that line's voice is regenerated (or re-recorded); the edit re-flows.
- Swap the shot (other good moments the AI found, ranked)
- Trim (start/end handles on that clip's range)
- Delete or drag to reorder

**Global controls:**
- Voice: switch AI voice or re-record; voice volume
- Music: pick by vibe, volume, or none
- Caption & title style: 4–6 presets matching the landing-page look (bold title on top, subtitle captions in the lower third) **[D]**
- Original clip audio: auto (kept for clips where the user is talking to camera, otherwise muted under the narration)

**"Tell the AI" box:** plain-language feedback that re-runs the edit planner with the current plan as context. Examples: "Make it punchier", "Open with the Eiffel Tower", "Less of me talking". Every version is kept for undo.

### 4.5 Share
- Export MP4 (H.264 + AAC), 1080×1920 for 9:16 (1080p for other formats), 30 fps. **[D]**
- Rendered **on the device** (§6.4), with progress and an estimated time.
- Mobile: the **Share** button opens the native share sheet (save to Photos, TikTok, Instagram, YouTube). Desktop: download.
- Caption, title and safe-zone placement avoid the parts of the screen that TikTok/Reels/Shorts UI covers.

## 5. AI features in detail

### 5.1 Clip understanding
For each clip, the app produces a **ClipAnalysis**:
- Short description ("Riding a bike along a tree-lined path, POV")
- Tags, shot type (talking-to-camera, wide, close-up, POV, pan)
- **Moments:** 1–5 ranked sub-ranges `{start, end, score, why}`, the best usable parts
- Quality flags: shaky, blurry, too dark, accidental/pocket recording, near-duplicate of another clip
- Transcript with word timestamps, if the person speaks on camera
- **Focus point** per moment (normalized x,y), used to crop horizontal footage to vertical

### 5.2 Script
The script is a **title + ordered lines**. Each line is one spoken sentence and one scene:

```
Title: "MY DAY IN NYC"
1 (hook):  "So I spent 24 hours in New York…"        → visual: skyline / walking shot
2:         "I woke up early and grabbed coffee."      → visual: coffee close-up
3:         "Then I biked through the park."            → visual: bike POV
4:         "Met Sam for lunch."                         → visual: lunch table
5 (outro): "Honestly? Best day this year."             → visual: sunset
```

Each line has: `text` (spoken narration, also the caption), `purpose` (hook / story / outro), `visualIntent` and optional `onScreenText` for an extra text overlay.

Rules for the AI script writer:
- First person, casual, spoken rhythm. Short sentences (≤ 15 words). Sounds like a creator, not an ad. **[D]**
- The **first line is a hook** (Shorts/Reels retention).
- Every line must be coverable by real footage (the writer gets the clip catalog). "Must include" clips appear.
- Written in the selected language, natively, not translated from English.
- Length guide: ~2.5 words/second of target length.

### 5.3 Voiceover
- **AI voice:** each script line is synthesized separately through a multilingual TTS provider with word-level timestamps. Per-line synthesis means editing one line only re-voices that line, and it gives exact timings for the cut.
- **Record your own:** recorded per line in the browser (MediaRecorder), then lightly cleaned up on device (trim silence, normalize loudness, light noise gate). Word timings come from STT on the recording.
- The voice track is the **master clock**. Each scene's length = its line's audio length plus a little breathing room. If the user skips narration, lengths come from the vibe/pace instead.

### 5.4 Edit planning
The planner turns *script + voice timings + clip catalog* into an **Edit Decision List (EDL)**, a strict JSON document the renderer plays deterministically (schema in §7). The AI decides *what* goes where; code decides *how* it's rendered. That makes it reliable and editable.

- One line usually maps to 1–3 shots (e.g. a 4 s line might be a 2.5 s bike POV plus a 1.5 s close-up).
- Talking-to-camera clips can play with their own audio, in which case narration pauses there.

After the model returns the EDL, code **validates and repairs** it:
- Clamp in/out points to real clip bounds; every scene exactly covers its line's audio
- Minimum shot length 0.8 s, maximum 6 s (except talking scenes) **[D]**
- Remove accidental duplicate ranges
- If validation fails badly, retry once with the errors attached. Otherwise fall back to a rule-based edit (best-scoring moment per line, in order), so the user **always** gets a video.

### 5.5 Captions, title, music & polish (deterministic, not AI)
- **Captions** = the narration, timed word by word from voice timestamps, shown a few words at a time in the lower third, with the current word highlighted. **[D]**
- **Title** big and bold at the top for the first ~3 s (landing-page style), optional to keep it pinned.
- **Music:** licensed library tagged by vibe/BPM; auto-ducks under the voice; fades at the end.
- Cut pace by vibe: Upbeat = more shots per line and hard cuts; Chill/Cinematic = longer shots and soft crossfades.
- Gentle per-clip brightness/contrast normalization so cuts don't jump. **[D]**

### 5.6 Languages
- **MVP:** the full pipeline (script writing, AI voice, captions, recorded-voice transcription) works in every language that **both** the TTS and STT providers support well. That's 20+ with current multilingual providers, which matches the landing page.
- **[D]** QA effort goes to a launch set first (e.g. English, Spanish, Portuguese, French, German, Hindi, Arabic, Japanese, Korean, Chinese). The rest are marked "beta" in the language picker.
- Caption rendering supports RTL scripts (Arabic, Hebrew) and CJK line breaking from day one, with bundled fonts covering them.
- UI translation (app interface) is P1. MVP UI is English.

## 6. Technical architecture

### 6.1 Stack **[D]**
| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript, Tailwind, shadcn/ui | Same stack as the client's Lovable landing page, so it can be merged into this codebase as-is |
| State | Zustand | Simple, fits an editor-like app |
| Local storage | IndexedDB (Dexie) for project data; OPFS for media files | Projects survive refresh; raw video never uploaded |
| Video I/O | WebCodecs + **Mediabunny** (demux/mux MP4/MOV/WebM) | Hardware-accelerated decode/encode in the browser; fast and no server render cost |
| Fallback decode | ffmpeg.wasm (lazy-loaded) | Codecs the browser can't decode (e.g. HEVC on some Windows Chrome) |
| Audio | Web Audio API / OfflineAudioContext; MediaRecorder for voice recording | Mixing, ducking, loudness, recording |
| Backend | Supabase: Auth, Postgres (waitlist, users, quotas), Edge Functions | AI calls go through Edge Functions so API keys never reach the browser |
| LLM | Anthropic Claude via `@anthropic-ai/sdk` in Edge Functions | Vision + script writing + structured JSON output |
| Text-to-speech | Multilingual TTS with word timestamps, behind an interface (provider TBD, e.g. ElevenLabs) | AI voiceover in 20+ languages |
| Speech-to-text | Multilingual Whisper-class STT with word timestamps, behind an interface (provider TBD) | On-camera speech + recorded voiceover timings |
| Music | Curated, licensed royalty-free library (~30 tracks, tagged by vibe/BPM) in Supabase Storage | Licensing safety |

### 6.2 Processing pipeline

```
 DEVICE (browser)                                    SERVER (Supabase Edge Functions)
 ───────────────                                     ────────────────────────────────
 1. Read clip metadata (duration, size, rotation, date)
 2. Thumbnails + sample frames (≈1 fps, 512px JPEG)
 3. Local signals: sharpness, brightness, motion,
    loudness, voice activity, near-duplicates
 4. Contact sheet per clip (frames + timestamps) ─────►  analyze-clip  (Claude vision → ClipAnalysis)
 5. 16 kHz mono audio for clips with speech ──────────►  transcribe    (STT → word timestamps)
        ── steps 1–5 run while the user writes the script ──
 6. Catalog + bullets/prompt + language ───────────────►  write-script  (Claude → Script)
 7a. AI voice: each line ─────────────────────────────►  synthesize    (TTS → audio + word timings)
 7b. Own voice: record per line on device ────────────►  transcribe    (STT → word timings)
 8. Script + timings + catalog + settings ────────────►  plan-edit     (Claude → EDL)
 9. Validate & repair EDL (shared TS code)
10. Real-time preview (canvas compositor)
11. Export: decode → composite → encode → mux MP4 (WebCodecs, in a Worker)
```

- **Contact sheets** (a grid of ~8–12 frames per clip in one image) keep vision cost and latency low.
- Edge Functions are **stateless proxies**: no video is stored server-side; frames and audio are discarded after each request. Generated TTS audio goes straight back to the device.

### 6.3 Smart vertical crop
For horizontal clips in a 9:16 vlog, the renderer crops around the moment's **focus point** from clip analysis. MVP uses one static focus point per shot; per-frame subject tracking is P1.

### 6.4 Rendering
- **Preview:** a canvas compositor that plays the EDL in real time from the original files, plus the voice, captions and music mix. No pre-render needed.
- **Export:** WebCodecs `VideoDecoder` → OffscreenCanvas composition (crop, color, transitions, title, captions) → `VideoEncoder` (H.264) + mixed audio (AAC) → Mediabunny MP4 muxer, in a Web Worker.
- **Target:** export a 30 s 1080×1920 vlog in ≤ 30 s on a recent iPhone, Android or laptop.
- Server-side rendering is out of MVP. It can be added later from the same EDL.

### 6.5 Models & AI calls **[D]**
| Call | Model / service | Notes |
|---|---|---|
| analyze-clip | Claude Opus 5.5 (`claude-opus-5-5`), low effort | One per clip, in parallel; structured output |
| write-script / polish | Claude Opus 5.5, medium effort | Streams lines into the editor as they're written |
| plan-edit / revise-edit | Claude Opus 5.5, medium–high effort | Structured output (`output_config.format`) against the EDL schema |
| synthesize | TTS provider | One request per line; cached by (text, voice, language) |
| transcribe | STT provider | On-camera speech + recorded voiceover |

- All Claude calls use **structured outputs**, so responses always parse against our schemas. Static prompt parts are prompt-cached, and the clip catalog is reused across script, plan and revise calls.
- **Cost estimate** (to be measured in M2): Claude **~$0.30–$0.80 per vlog** (10–15 clips), STT ~$0.01–$0.05, TTS a few cents for a 30–60 s narration (provider-dependent). Revisions are cheaper because of caching and per-line voice caching. Moving clip analysis to Claude Haiku 5.5 would cut that call's cost substantially. That's a client cost/quality call (§11).
- Every call has a timeout, one retry, and a non-AI fallback where one exists.

### 6.6 Browser support **[D]**
- Full: latest Chrome/Edge (desktop + Android), Safari 17+ (iOS + macOS).
- Best-effort: Firefox.
- A capability check on first load shows a friendly message if the device can't record or export.

### 6.7 Visual design **[D]**
The app inherits the landing page's look so the marketing and the product feel like one thing:
- Light, airy background with soft blue/cyan glows; white rounded cards with subtle shadows
- **Blue → cyan gradient** for primary buttons and accents (matching "Join the Waitlist" and "Instantly.")
- Bold, tight sans-serif headlines; grey secondary text
- Gradient-filled square icons (mic, sparkles, bolt)
- Phone-frame preview of the vlog, like the landing page mockups
- The landing page itself is ported into this codebase as the marketing home (`/`), with the app at `/create`

## 7. Data model

```ts
type Project = {
  id: string; title: string; createdAt: string; updatedAt: string;
  language: string;                                  // BCP-47, e.g. 'en', 'es', 'pt-BR'
  settings: { aspect: '9:16' | '1:1' | '16:9'; targetSec: 'auto' | 15 | 30 | 60; vibe: Vibe };
  prompt?: string;
  clipIds: string[];
  script?: Script;
  voice: { mode: 'ai' | 'recorded' | 'none'; voiceId?: string; volumeDb: number };
  editVersions: EditPlan[];                          // undo history; last = current
  musicTrackId?: string | null;
  styleId: StyleId;                                  // title + caption preset
};

type Clip = {
  id: string; projectId: string; fileName: string;
  opfsPath: string;                                  // local only, never uploaded
  durationSec: number; width: number; height: number; rotation: 0|90|180|270;
  recordedAt?: string; mustInclude: boolean;
  analysis?: ClipAnalysis; transcript?: Transcript;
};

type ClipAnalysis = {
  description: string; tags: string[];
  shotType: 'talking_head' | 'wide' | 'closeup' | 'pov' | 'pan' | 'other';
  quality: { shaky: boolean; blurry: boolean; dark: boolean; accidental: boolean; duplicateOf?: string };
  moments: { start: number; end: number; score: number; why: string; focus: { x: number; y: number } }[];
};

type Script = {
  title: string;
  lines: {
    id: string; text: string; purpose: 'hook' | 'story' | 'outro';
    visualIntent: string; onScreenText?: string;
    audio?: { opfsPath: string; durationSec: number;
              words: { word: string; start: number; end: number }[] };   // AI or recorded
  }[];
};

// The Edit Decision List: the single source of truth the renderer plays.
type EditPlan = {
  version: number; createdBy: 'ai' | 'user' | 'fallback'; note?: string;
  aspect: '9:16' | '1:1' | '16:9'; fps: 30;
  scenes: {
    lineId?: string;                                 // narration line this scene carries
    shots: {
      id: string; clipId: string;
      in: number; out: number;                       // seconds within the clip
      crop: { focusX: number; focusY: number; zoom: number };
      speed: 1 | 0.5 | 2;
      clipAudio: 'mute' | 'duck' | 'full';
      transitionIn: 'cut' | 'crossfade' | 'dip' | 'whip';
    }[];
  }[];
  title: { text: string; showUntilSec: number | 'always' };
  music?: { trackId: string; startSec: number; gainDb: number; duckUnderVoice: boolean };
};
```

Server-side (Supabase) stores only the **waitlist, accounts, usage counters and (optionally) project metadata/EDLs**, never video.

## 8. Non-functional requirements
- **Speed:** preview in < 60 s after Generate for typical input; thumbnails in < 2 s; a single line's voice regenerates in < 3 s.
- **Reliability:** generation always yields a playable vlog (AI → retry → rule-based fallback).
- **Privacy:** raw footage stays on device, stated plainly in the UI and privacy policy. AI providers get only downscaled frames, speech audio and script text, with no training use. Recorded voices are never used to build voice clones.
- **Accessibility:** keyboard-navigable editor, captions on by default, WCAG AA contrast in the UI.
- **Abuse/cost control:** AI endpoints require a signed-in user (or a guest token with a 1-vlog trial); per-user daily quotas enforced in Edge Functions.
- **Observability:** per-stage timings, tokens/cost per call, failure and fallback rates. No media, transcripts or scripts in logs.

## 9. Scope

### MVP (v1.0)
Everything in §4–§8: working waitlist, clip upload with background analysis, script (write / AI / polish / skip), **AI voiceover + record your own**, **20+ languages** for script/voice/captions, AI edit cut to narration, title + word-synced captions, music, smart crop, scene-card tweaks, "Tell the AI" revisions, on-device export, share sheet, auth + quotas, local projects.

### P1 (fast follow)
- Photos as Ken-Burns shots
- Beat-synced cuts to music
- Per-frame subject tracking for crops
- Templates ("Day in my life", "Travel diary", "GRWM", "Product showcase")
- Translate an existing vlog into another language (re-voice + re-caption)
- App UI localization
- Cloud project sync across devices

### Out of scope (for now)
Stock footage (by design: "works with your footage") · multi-track pro timeline · voice cloning · collaboration · direct posting via TikTok/IG APIs · server-side rendering · native mobile apps.

## 10. Milestones **[D]**
Rendering is the riskiest piece, so it's proven before the AI.

| # | Milestone | Outcome |
|---|---|---|
| M0 | Foundations + waitlist | Repo, CI, design system from the landing page, landing page ported with a **working waitlist** (Supabase), app shell, add/remove clips, local persistence, capability check |
| M1 | Render engine | Hand-written EDL + audio file → real-time preview → MP4 export with crop, title, word captions (incl. RTL/CJK), music ducking, transitions, on iPhone, Android and desktop |
| M2 | AI pipeline | Frame sampling + contact sheets, STT, clip analysis, script writer, TTS, edit planner, validation/repair, fallback edit; cost measured |
| M3 | Script, voice & tweak UX | Script editor, voice picker, record-your-own teleprompter, scene cards, swap/trim, per-line re-voice, "Tell the AI", version history |
| M4 | Accounts & launch | Auth, quotas, languages QA, onboarding, error states, analytics, real product screenshots on the landing page |

## 11. Open questions for the client
1. **Name:** Autovlog, Autoroll (title tags + autoroll.ai), or Instant Vlog Clip? Do they own the domain?
2. **Waitlist:** the current form doesn't save signups. OK to fix it now (M0)? Is there an email tool they want signups sent to (Mailchimp, Loops, etc.)?
3. **Monetization:** the page says free / no credit card. Free forever at launch, or free plus paid later? Watermark?
4. **Voices:** any preference on voice style or provider? OK that AI voices are stock voices (no cloning)?
5. **Languages:** which ones matter most for launch QA?
6. **Accounts:** OK to require sign-in after one free trial vlog?
7. **Model cost vs quality:** OK with roughly $0.40–$1.00 total AI cost per vlog, or should parts use cheaper models?
8. **Music:** do they have a library or license, or do we source one?
9. **Early-access perks:** the page promises them. What are they?

## 12. Success metrics
- **Time to first vlog:** median < 3 min from landing to exported video
- **Export rate:** % of generated vlogs that get exported (target > 60%)
- **"Good first try" rate:** % exported with ≤ 2 tweaks
- **Voice mix:** % using AI voice vs own voice vs none (informs where to invest)
- **Fallback rate:** % of generations hitting the rule-based fallback (target < 2%)
- **Return rate:** % creating a second vlog within 7 days
- **Waitlist → activated:** % of waitlist signups who create a vlog in their first week of access
