# Instant Vlog Clip — Product & Technical Spec

**Status:** Draft v0.3 · **Date:** 2026-10-08
**Client brief (verbatim):** "Turn raw footage into polished vlog videos automatically. User adds clips, maybe a quick script with AI — then mini-vlog created based on clips and script."
**Inspiration:** https://instant-vlog-creator.lovable.app, an example mock the client shared to show the idea (screenshots in [docs/reference/](reference/)). We are **not** using or rebuilding that page. We take the product ideas from it that make sense to build (§2).

Everything beyond the brief is a product decision made in this document. Decisions are marked **[D]** so they're easy to find and override.

> **v0.3 changes:** the example mock is inspiration only, not a deliverable. Removed everything about porting that page (waitlist, branding, its visual style). Kept the product ideas worth building: **voiceover** (AI or your own voice) stays in the MVP, and the script stays narration-first. Multi-language is scaled back to "English at launch, built so more languages are a configuration change".

---

## 1. Product in one paragraph

Instant Vlog Clip is a web app that turns a pile of phone clips into a short, narrated, shareable vlog in about a minute. The user drops in their clips and writes a few bullet points about their day, or lets AI write them. The app turns those into a short first-person script, voices it (AI voice, or the user records their own), picks the best moments from each clip, cuts them to the narration, adds synced captions, a title and music, and exports a ready-to-post vertical MP4. The user can tweak the result (reorder, trim, edit lines, swap music or voice) but never has to touch a timeline.

## 2. Ideas taken from the example mock

The client's example mock (a landing page) shows the idea they have in mind. We don't build that page. We use it to understand the product they picture and pick what to implement.

| Idea in the example | Decision | Where |
|---|---|---|
| Clips → vlog "instantly", "ready in 60 seconds" | **MVP.** Background clip analysis while the user writes the script; target **< 60 s** from Generate to preview | §4.3, §8 |
| Pick videos "from your messy phone gallery" | **MVP.** Mobile-first picker; junk/duplicate shots detected and deprioritized | §4.1, §5.1 |
| "Write your story or let AI generate it" | **MVP.** Bullet-point script editor + "Write it for me" + "Polish" | §4.2, §5.2 |
| Voiceover: "AI-generated or record your own voice" | **MVP.** It's what makes this feel like a real vlog rather than a montage, and it's feasible | §4.3, §5.3 |
| Auto cuts, captions and music, "auto-synced" | **MVP.** Edit cut to the narration, word-synced captions, music ducking | §5.4, §5.5 |
| Made for TikTok, Reels and Shorts | **MVP.** 9:16 default, safe-zone-aware text, 1080×1920 export | §4.5, §5.5 |
| Output look: bold title on top, narration captions in the lower third | **MVP.** The default style preset | §5.5 |
| Works with *your* footage, not stock | **MVP** by design; no stock footage | §9 |
| For creators, not corporate; no manual timeline | **MVP.** Casual first-person tone; scene cards instead of a timeline | §4.4, §5.2 |
| "20+ languages" | **Partly.** English at launch; pipeline language-aware from day one so adding languages is configuration + QA, not a rebuild | §5.6, §9 |
| Marketing page, waitlist, pricing | **Not ours.** Out of scope | §9 |

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

Same four-step shape as the example mock: Upload → Script → AI Magic → Share.

### 4.1 Upload your clips
- Drag-and-drop on desktop; native picker on mobile (camera-roll access).
- Accepts MP4, MOV (incl. iPhone HEVC), WebM. Photos are P1.
- **[D] Limits (MVP):** up to 30 clips, 10 min total footage, 4 GB total, with a clear message if exceeded.
- Thumbnails appear immediately. Analysis starts in the background while the user writes the script, so Generate feels instant.
- "Messy gallery" handling: accidental recordings, pocket shots and near-duplicates are detected and quietly deprioritized (§5.1). The user can remove clips or star them as **Must include**.

### 4.2 Add your script
One screen, following the shape of the example mock:

- **Title** field (e.g. "My Day in NYC"). AI suggests one if left blank. Shown as the on-screen title.
- **Script box** with bullet points, first person, one line per moment. Placeholder: *"I woke up early and grabbed coffee."*
- Buttons:
  - **✨ Write it for me**: AI drafts bullets from the clips (and an optional one-line prompt like "chill Sunday in Lisbon"). It only describes things that are actually in the footage.
  - **Polish**: AI rewrites the user's own bullets into natural spoken narration, keeping their meaning and voice.
  - **Skip narration**: music + title + text captions only, no voice.
- **Settings chips** with defaults:
  - Language: English at launch (§5.6) **[D]**
  - Format: **9:16** (default) · 1:1 · 16:9 **[D]**
  - Length: **Auto** (fits the narration, typically 20–60 s) · 15s · 30s · 60s **[D]**
  - Vibe: **Auto** · Chill · Upbeat · Cinematic · Funny · Aesthetic. Drives music and cut pace. **[D]**

### 4.3 Pick a voice & generate
- **Voice:** a short list of AI voices (male/female, a few styles; tap to preview a line of *their* script) **or 🎙 Record my own**.
  - Record mode shows a teleprompter: one line at a time, tap to record, re-record any line. Each line is a separate take, so mistakes are cheap to fix.
- **Generate:** a progress screen with honest stages: *Watching your clips → Voicing your script → Picking the best moments → Cutting it together → Adding captions & music.*
- Target: **under 60 s** from Generate to playable preview (10 clips, ~3 min footage, recent phone or laptop). 

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
- Caption & title style: 4–6 presets; the default is a bold title on top with narration captions in the lower third **[D]**
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
- **Title** big and bold at the top for the first ~3 s, optional to keep it pinned.
- **Music:** licensed library tagged by vibe/BPM; auto-ducks under the voice; fades at the end.
- Cut pace by vibe: Upbeat = more shots per line and hard cuts; Chill/Cinematic = longer shots and soft crossfades.
- Gentle per-clip brightness/contrast normalization so cuts don't jump. **[D]**

### 5.6 Languages **[D]**
- **MVP: English.** Script writing, AI voices, captions and transcription are tuned and tested in English.
- **Built to expand:** every project carries a `language`; prompts, voice choice and caption fonts are keyed off it, and the chosen TTS/STT providers are multilingual. Adding a language means enabling it, picking voices and QA, not new code.
- Caption rendering is built with RTL and CJK in mind (fonts, line breaking) so those languages don't need a renderer change later.

## 6. Technical architecture

### 6.1 Stack **[D]**
| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript, Tailwind, shadcn/ui | Mainstream, fast to build, large ecosystem, accessible components |
| State | Zustand | Simple, fits an editor-like app |
| Local storage | IndexedDB (Dexie) for project data; OPFS for media files | Projects survive refresh; raw video never uploaded |
| Video I/O | WebCodecs + **Mediabunny** (demux/mux MP4/MOV/WebM) | Hardware-accelerated decode/encode in the browser; fast and no server render cost |
| Fallback decode | ffmpeg.wasm (lazy-loaded) | Codecs the browser can't decode (e.g. HEVC on some Windows Chrome) |
| Audio | Web Audio API / OfflineAudioContext; MediaRecorder for voice recording | Mixing, ducking, loudness, recording |
| Backend | Supabase: Auth, Postgres (users, quotas), Edge Functions | AI calls go through Edge Functions so API keys never reach the browser |
| LLM | Anthropic Claude via `@anthropic-ai/sdk` in Edge Functions | Vision + script writing + structured JSON output |
| Text-to-speech | Multilingual TTS with word timestamps, behind an interface (provider TBD, e.g. ElevenLabs) | AI voiceover; multilingual so more languages are easy to add |
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
Our own design system, built for a mobile-first creator tool:
- Clean, light UI that keeps attention on the video; dark mode supported
- One bright accent color for primary actions; everything else neutral
- Phone-frame preview of the vlog as the centerpiece of the editor
- Large touch targets and bottom-sheet controls on mobile
- Brand name, logo and colors to be confirmed with the client (§11). The design tokens make a rebrand a one-file change.

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

Server-side (Supabase) stores only **accounts, usage counters and (optionally) project metadata/EDLs**, never video.

## 8. Non-functional requirements
- **Speed:** preview in < 60 s after Generate for typical input; thumbnails in < 2 s; a single line's voice regenerates in < 3 s.
- **Reliability:** generation always yields a playable vlog (AI → retry → rule-based fallback).
- **Privacy:** raw footage stays on device, stated plainly in the UI and privacy policy. AI providers get only downscaled frames, speech audio and script text, with no training use. Recorded voices are never used to build voice clones.
- **Accessibility:** keyboard-navigable editor, captions on by default, WCAG AA contrast in the UI.
- **Abuse/cost control:** AI endpoints require a signed-in user (or a guest token with a 1-vlog trial); per-user daily quotas enforced in Edge Functions.
- **Observability:** per-stage timings, tokens/cost per call, failure and fallback rates. No media, transcripts or scripts in logs.

## 9. Scope

### MVP (v1.0)
Everything in §4–§8: clip upload with background analysis, script (write / AI / polish / skip), **AI voiceover + record your own**, English (language-ready pipeline), AI edit cut to narration, title + word-synced captions, music, smart crop, scene-card tweaks, "Tell the AI" revisions, on-device export, share sheet, auth + quotas, local projects.

### P1 (fast follow)
- More languages for script, voice and captions
- Photos as Ken-Burns shots
- Beat-synced cuts to music
- Per-frame subject tracking for crops
- Templates ("Day in my life", "Travel diary", "GRWM", "Product showcase")
- Translate an existing vlog into another language (re-voice + re-caption)
- App UI localization
- Cloud project sync across devices

### Out of scope (for now)
Stock footage (by design) · marketing site / waitlist · multi-track pro timeline · voice cloning · collaboration · direct posting via TikTok/IG APIs · server-side rendering · native mobile apps.

## 10. Milestones **[D]**
Rendering is the riskiest piece, so it's proven before the AI.

| # | Milestone | Outcome |
|---|---|---|
| M0 | Foundations | Repo, CI, design system, app shell, add/remove clips, local persistence, capability check |
| M1 | Render engine | Hand-written EDL + audio file → real-time preview → MP4 export with crop, title, word captions, music ducking, transitions, on iPhone, Android and desktop |
| M2 | AI pipeline | Frame sampling + contact sheets, STT, clip analysis, script writer, TTS, edit planner, validation/repair, fallback edit; cost measured |
| M3 | Script, voice & tweak UX | Script editor, voice picker, record-your-own teleprompter, scene cards, swap/trim, per-line re-voice, "Tell the AI", version history |
| M4 | Accounts & launch | Auth, quotas, onboarding, error states, analytics |

## 11. Open questions
**Settled:**
- Name & branding: the client will provide them later. The UI uses neutral design tokens so branding drops in.
- Languages: English only for now (§5.6).
- Pricing: decided by the project owner, not the client. The spec only needs per-user usage limits (§8) and the AI cost per vlog (§6.5) as input.
- Voices: **[D]** we pick ~6 stock English AI voices (mix of male/female, calm/energetic, American/British) plus "record your own". No voice cloning.

**Still open:**
1. **Accounts:** require sign-in after one free trial vlog?
2. **Music:** does the client have a library or license, or do we source one?

## 12. Success metrics
- **Time to first vlog:** median < 3 min from opening the app to exported video
- **Export rate:** % of generated vlogs that get exported (target > 60%)
- **"Good first try" rate:** % exported with ≤ 2 tweaks
- **Voice mix:** % using AI voice vs own voice vs none (informs where to invest)
- **Fallback rate:** % of generations hitting the rule-based fallback (target < 2%)
- **Return rate:** % creating a second vlog within 7 days
