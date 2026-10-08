# Instant Vlog Clip — Product & Technical Spec

**Status:** Draft v0.1 · **Date:** 2026-10-08
**Client brief (verbatim):** "Turn raw footage into polished vlog videos automatically. User adds clips, maybe a quick script with AI — then mini-vlog created based on clips and script."
**Reference:** https://instant-vlog-creator.lovable.app (client's Lovable prototype). We don't have access to it, so this spec is built from the brief alone and doesn't depend on it.

Everything beyond the brief is a product decision made in this document. Decisions are marked **[D]** so they're easy to find and override.

---

## 1. Product in one paragraph

Instant Vlog Clip is a web app that turns a pile of phone clips into a short, shareable vlog in a couple of minutes. The user drops in their clips, optionally says what the vlog is about ("Saturday in Lisbon, chill vibe"), and the app writes a short script, picks the best moments from each clip, cuts them together to match the script, adds captions and music, and exports a ready-to-post MP4. The user can tweak the result (reorder, trim, edit captions, swap music) but never has to touch a timeline.

## 2. Who it's for

**[D] Primary user:** casual creators — travellers, students, small-business owners, people who film a lot on their phone but never edit it. They post to Instagram Reels, TikTok and YouTube Shorts.

They are **not** professional editors. They don't want a timeline, keyframes or export settings. They want a good-looking result fast and a couple of simple knobs.

**Jobs to be done**
1. "I filmed my day/trip/event and want something to post today."
2. "I have an idea for a short video and some clips; help me tell it."
3. "I want it to look like I spent an hour editing."

## 3. Product principles

1. **Instant first, perfect second.** The first result should arrive without any decisions. Every option has a good default.
2. **The script is the spine.** The AI edits *to a story*, not just a montage. That's the difference from a "random highlights" app.
3. **Edit by talking, not by timeline.** Tweaks happen on scene cards and through plain-language feedback ("make it faster", "start with the beach").
4. **Your footage stays yours.** Raw video never leaves the device. Only small preview frames and speech audio are sent for AI analysis. **[D]**
5. **Mobile-first web.** Most footage lives on phones, so the full flow must work in a phone browser.

## 4. Core user flow

```
New vlog → Add clips → Tell the story (optional) → Generate → Preview & tweak → Export & share
```

### 4.1 Add clips
- Drag-and-drop on desktop; native file picker on mobile (gives camera-roll access).
- Accepts MP4, MOV (incl. iPhone HEVC), WebM. **[D]** Photos are P1 (§9).
- **[D] Limits (MVP):** up to 30 clips, 10 min total footage, 4 GB total. A clear message if exceeded.
- Clips appear as a thumbnail grid immediately. Analysis starts in the background while the user moves to the next step, so "Generate" feels instant.
- User can remove clips and mark one or more as **"Must include"** (star).

### 4.2 Tell the story (optional, skippable)
One screen with three things:

1. **"What's this vlog about?"**: a single text box with an example placeholder ("A rainy Sunday baking with my sister"). Optional.
2. **Settings chips** with defaults:
   - Format: **9:16 vertical** (default) · 1:1 · 16:9 **[D]**
   - Length: 15s · **30s** (default) · 60s · 90s **[D]**
   - Vibe: **Auto** · Chill · Upbeat · Cinematic · Funny · Aesthetic **[D]**
3. **Script** with three modes:
   - **Write it for me** (default): AI drafts the script from the prompt *and from what's actually in the clips*, so it never asks for a shot that doesn't exist.
   - **I'll write it**: the user types or pastes their own script or bullet points; AI fits footage to it.
   - **No script**: the AI builds a story arc from the footage alone.

The generated script is shown as editable **beats** before the edit is built (§5.2). The user can accept with one tap or edit any line.

### 4.3 Generate
- A single progress screen with honest stages: *Watching your clips → Writing the story → Picking the best moments → Cutting it together → Adding music & captions.*
- Target: **under 60 s** from "Generate" to playable preview for a typical input (10 clips, ~3 min of footage) on a recent phone or laptop.
- Preview starts playing as soon as it's ready. No waiting for a full export.

### 4.4 Preview & tweak
Layout: video player on top, **scene strip** below (one card per scene, in order).

Each **scene card** lets you:
- Edit the caption text (or hide it)
- Trim (simple start/end handles on that clip's range)
- Swap the shot (shows other good moments the AI found, ranked)
- Delete or drag to reorder

**Global controls:**
- Music: pick from library by vibe, adjust volume, or "no music"
- Caption style: 4–6 presets (font, position, animation) **[D]**
- Keep original audio: on/off per scene (default: on for talking scenes, ducked under music otherwise)
- Format & length (changing these re-plans the edit)

**"Tell the AI" box:** plain-language feedback that re-runs the edit planner with the current plan as context. Examples: "Make it punchier", "Open with the sunset shot", "Less of me talking". Keeps an undo history of versions.

### 4.5 Export & share
- Export MP4 (H.264 + AAC), 1080p at the chosen aspect ratio, 30 fps. **[D]**
- Rendered **on the device** (§6.4). Progress bar plus an estimated time.
- On mobile: the **Share** button opens the native share sheet (save to Photos, send to Instagram or TikTok). On desktop: download.
- **[D]** Free tier exports carry a small, tasteful end-card watermark; the paid tier removes it (pending client decision, §11).

## 5. AI features in detail

### 5.1 Clip understanding
For each clip, the app produces a **ClipAnalysis**:
- Short description ("Close-up of hands kneading dough on a wooden table")
- Tags (people, food, outdoors, talking-to-camera, b-roll…)
- Shot type (selfie/talking head, wide, close-up, POV, pan)
- **Moments:** 1–5 ranked sub-ranges `{start, end, score, why}` that are the best usable parts
- Quality flags: shaky, blurry, too dark, accidental recording
- Transcript with timestamps, if there's speech
- **Focus point** per moment (normalized x,y), used to crop horizontal footage into vertical (§6.3)

### 5.2 Script
A script is a short list of **beats**, not prose:

```
Title: "Lisbon in a Day"
Hook (0–3s):   "POV: you have 24 hours in Lisbon"   → visual: tram / skyline
Beat 2:        "Started with the best pastel de nata of my life" → visual: pastry close-up
Beat 3:        ...
Outro:         "Would you go back? I would." → visual: sunset
```

Each beat has: `purpose` (hook / story / payoff / outro), `caption` (on-screen text, ≤ 8 words **[D]**), optional `voiceover` line (used in P1), `visualIntent` (what the shot should show) and `targetDuration`.

Rules the script writer follows:
- First 2–3 seconds must be a **hook** (Shorts/Reels retention).
- Every beat must be coverable by footage that actually exists (the writer is given the clip catalog).
- Clips marked "Must include" must appear.
- Respect target length ±10%.

### 5.3 Edit planning
The planner turns *script + clip catalog* into an **Edit Decision List (EDL)**, a strict JSON document the renderer executes deterministically (schema in §7). The AI decides *what* goes where; code decides *how* it's rendered. This keeps output reliable and editable.

After the model returns the EDL, code **validates and repairs** it:
- Clamp in/out points to real clip bounds
- Enforce minimum shot length (0.8 s) and maximum (6 s, except talking scenes) **[D]**
- Fix total duration to target ±10% by trimming or extending the lowest-score shots
- Remove accidental duplicate ranges
- If validation fails badly, retry the model once with the errors attached; otherwise fall back to a rule-based "best moments in chronological order" edit, so the user **always** gets a video.

### 5.4 Pacing & polish (deterministic, not AI)
- Cut style by vibe: Upbeat = shorter shots and hard cuts; Chill/Cinematic = longer shots and soft crossfades.
- Music ducks automatically under speech.
- Gentle auto color normalization (brightness/contrast) per clip so cuts don't jump. **[D]**
- Captions animate in word-by-word for talking scenes (from transcript) and as title cards for b-roll beats.

## 6. Technical architecture

### 6.1 Stack **[D]**
| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript, Tailwind, shadcn/ui | Mainstream, fast to build, and the same stack Lovable generates, which makes porting anything from the prototype easy later |
| State | Zustand | Simple, fits an editor-like app |
| Local storage | IndexedDB (Dexie) for project data; OPFS for media files | Projects survive refresh; raw video never uploaded |
| Video I/O | WebCodecs + **Mediabunny** (demux/mux MP4/MOV/WebM) | Hardware-accelerated decode/encode in the browser; fast and no server render cost |
| Fallback decode | ffmpeg.wasm (lazy-loaded) | For codecs the browser can't decode (e.g. HEVC on some Windows Chrome) |
| Audio | Web Audio API / OfflineAudioContext | Mixing, ducking, loudness |
| Backend | Supabase: Auth, Postgres, Edge Functions | Lovable-native; AI calls go through Edge Functions so API keys never reach the browser |
| LLM | Anthropic Claude via `@anthropic-ai/sdk` in Edge Functions | Vision + script writing + structured JSON output |
| Speech-to-text | Hosted Whisper-class STT behind an interface (provider TBD) | Transcripts for talking scenes & word-level captions |
| Music | Curated, licensed royalty-free library (~30 tracks, tagged by vibe/BPM) stored in Supabase Storage | Licensing safety |

### 6.2 Processing pipeline

```
 DEVICE (browser)                                   SERVER (Supabase Edge Functions)
 ───────────────                                    ────────────────────────────────
 1. Read clip metadata (duration, size, rotation, date)
 2. Thumbnails + sample frames (≈1 fps, 512px JPEG)
 3. Local signals: sharpness, brightness, motion,
    loudness, voice activity
 4. Build a contact sheet per clip (frames + timestamps) ──►  analyze-clip   (Claude vision → ClipAnalysis JSON)
 5. Extract 16 kHz mono audio for clips with speech ──────►  transcribe     (STT → word timestamps)
 6. Clip catalog (analyses + transcripts) + user prompt ──►  write-script   (Claude → Script JSON)
 7. Script + catalog + settings ──────────────────────────►  plan-edit      (Claude → EDL JSON)
 8. Validate & repair EDL (shared TS code, runs on both sides)
 9. Real-time preview (canvas compositor)
10. Export: decode → composite → encode → mux MP4 (WebCodecs)
```

- Steps 1–5 start the moment clips are added, in parallel, so most of the work is done before the user taps Generate.
- **Contact sheets** (a grid of ~8–12 frames per clip in one image) keep vision cost and latency low compared with sending frames one by one.
- Edge Functions are **stateless proxies**: no media is stored server-side. Frames and audio are discarded after the request.

### 6.3 Smart vertical crop
Most phone footage is already vertical. For horizontal clips placed in a 9:16 vlog, the renderer crops around the moment's **focus point** from clip analysis (with a slight ease if the point moves between moments). MVP uses one static focus point per shot. Per-frame subject tracking is P1.

### 6.4 Rendering
- **Preview:** a canvas compositor that plays the EDL in real time from the original files (seek + draw), with captions and audio mix. No pre-render needed.
- **Export:** a frame-accurate pipeline: WebCodecs `VideoDecoder` → canvas/OffscreenCanvas composition (crop, color, transitions, captions) → `VideoEncoder` (H.264) + mixed audio (AAC) → Mediabunny MP4 muxer. Runs in a Web Worker so the UI stays responsive.
- **Target:** export a 30 s 1080p vlog in ≤ 30 s on a recent iPhone/Android/laptop.
- **Server-side rendering is explicitly out of MVP.** It can be added later behind the same EDL if needed (e.g. for older devices).

### 6.5 Models & AI calls **[D]**
| Call | Model | Notes |
|---|---|---|
| analyze-clip | Claude Opus 5.5 (`claude-opus-5-5`), low effort | One call per clip, run in parallel; structured output |
| write-script | Claude Opus 5.5, medium effort | Streams beats to the UI as they're written |
| plan-edit / revise-edit | Claude Opus 5.5, medium–high effort | Structured output (`output_config.format`) against the EDL JSON schema |

- All calls use **structured outputs** so responses are guaranteed to be valid JSON for our schemas.
- The static parts of the prompts (instructions, schemas) are prompt-cached; the clip catalog is reused between script, plan and revise calls.
- **Cost estimate** (to be measured in M2): roughly **$0.30–$0.80 per generated vlog** for 10–15 clips, plus about $0.01–$0.05 for STT. Revisions are cheaper because the catalog is cached. Switching clip analysis to Claude Haiku 5.5 would cut that call's cost a lot. That's a client cost/quality decision (§11).
- Every call has a timeout, one retry, and a non-AI fallback, so the app degrades instead of failing.

### 6.6 Browser support **[D]**
- Full support: latest Chrome/Edge (desktop + Android), Safari 17+ (iOS + macOS).
- Best-effort: Firefox (WebCodecs supported; HEVC input may need the ffmpeg.wasm fallback).
- A capability check runs on first load with a friendly message if the device can't export.

## 7. Data model

```ts
type Project = {
  id: string; title: string; createdAt: string; updatedAt: string;
  settings: { aspect: '9:16' | '1:1' | '16:9'; targetSec: 15 | 30 | 60 | 90; vibe: Vibe };
  prompt?: string;
  clipIds: string[];
  scriptId?: string;
  editVersions: EditPlan[];      // undo history; last = current
  musicTrackId?: string | null;
  captionStyle: CaptionStyleId;
};

type Clip = {
  id: string; projectId: string; fileName: string;
  opfsPath: string;              // local only, never uploaded
  durationSec: number; width: number; height: number; rotation: 0|90|180|270;
  recordedAt?: string; mustInclude: boolean;
  analysis?: ClipAnalysis; transcript?: Transcript;
};

type ClipAnalysis = {
  description: string; tags: string[];
  shotType: 'talking_head' | 'wide' | 'closeup' | 'pov' | 'pan' | 'other';
  quality: { shaky: boolean; blurry: boolean; dark: boolean; accidental: boolean };
  moments: { start: number; end: number; score: number; why: string; focus: { x: number; y: number } }[];
};

type Script = {
  title: string;
  beats: { id: string; purpose: 'hook'|'story'|'payoff'|'outro';
           caption: string; voiceover?: string; visualIntent: string; targetSec: number }[];
};

// The Edit Decision List: the single source of truth the renderer plays.
type EditPlan = {
  version: number; createdBy: 'ai' | 'user' | 'fallback'; note?: string;
  aspect: '9:16' | '1:1' | '16:9'; fps: 30;
  shots: {
    id: string; clipId: string; beatId?: string;
    in: number; out: number;                       // seconds within the clip
    crop: { focusX: number; focusY: number; zoom: number };
    speed: 1 | 0.5 | 2;
    keepAudio: boolean; audioGainDb: number;
    caption?: { text: string; style: 'title' | 'subtitle' | 'karaoke' };
    transitionIn: 'cut' | 'crossfade' | 'dip' | 'whip';
  }[];
  music?: { trackId: string; startSec: number; gainDb: number; duckUnderSpeech: boolean };
};
```

Server-side (Supabase) stores only **accounts, usage counters and (optionally) project metadata/EDLs** — never media.

## 8. Non-functional requirements
- **Speed:** preview ready in < 60 s after Generate for typical input; first clip thumbnails in < 2 s.
- **Reliability:** generation always yields a playable vlog (AI → retry → rule-based fallback).
- **Privacy:** raw footage stays on device; this is stated plainly in the UI and privacy policy. AI providers receive only downscaled frames and speech audio, with no training use.
- **Accessibility:** keyboard-navigable editor, captions on by default, WCAG AA contrast in the UI.
- **Abuse/cost control:** AI endpoints require a signed-in user (or a guest token with a 1-vlog trial); per-user daily quotas enforced in the Edge Functions.
- **Observability:** log each pipeline stage's duration, model tokens/cost, failure reasons and fallback rate (no media, no transcripts in logs).

## 9. Scope

### MVP (v1.0)
Everything in §4–§8: clip upload, background analysis, AI script (3 modes), AI edit, scene-card tweaks, "Tell the AI" revisions, music library, caption presets, smart crop, on-device export, share sheet, auth + quotas, local projects.

### P1 (fast follow)
- **AI voiceover** from script lines (TTS, a few voices), mixed with ducking
- Photos as Ken-Burns shots
- Beat-synced cuts to music
- Per-frame subject tracking for crops
- Templates ("Day in my life", "Travel diary", "GRWM", "Product showcase")
- Caption translation / multi-language
- Cloud project sync across devices

### Out of scope (for now)
Multi-track pro timeline · collaboration · direct posting via TikTok/IG APIs · server-side rendering · native mobile apps · stock footage.

## 10. Milestones **[D]**
Rendering is the riskiest piece, so it's built and proven before the AI.

| # | Milestone | Outcome |
|---|---|---|
| M0 | Foundations | Repo, CI, app shell, design system, add/remove clips, local persistence, capability check |
| M1 | Render engine | Hand-written EDL → real-time preview → MP4 export with crop, captions, music, transitions, on iPhone + Android + desktop |
| M2 | AI pipeline | Frame sampling + contact sheets, STT, clip analysis, script writer, edit planner, validation/repair, fallback edit; cost measured |
| M3 | Tweak UX | Scene cards, swap shot, trim, captions, music picker, "Tell the AI" revisions, version history |
| M4 | Accounts & launch polish | Supabase auth, quotas, watermark/plan gating, analytics, onboarding, error states, landing page |

## 11. Open questions for the client
1. **The Lovable prototype:** we don't have access to it. If the client wants anything from it kept (branding, screens, copy), screenshots are enough.
2. **Monetization:** free plus paid? What does free include (watermark, number of vlogs/month, max length)?
3. **AI voiceover:** is narration central to "script", or are on-screen captions enough for v1? (Spec assumes captions in MVP, voiceover in P1.)
4. **Accounts:** OK to require sign-in after one free trial vlog?
5. **Model cost vs quality:** OK with ~$0.30–$0.80 AI cost per vlog, or should clip analysis use a cheaper model?
6. **Platforms:** is a phone browser good enough, or is a native app expected later?
7. **Languages:** English only at launch, or others for captions/scripts?
8. **Music:** does the client have a music library/license, or do we source one?
9. **Branding:** name, logo, colors, tone of voice.

## 12. Success metrics
- **Time to first vlog:** median < 3 min from landing to exported video
- **Export rate:** % of generated vlogs that get exported (target > 60%)
- **"Good first try" rate:** % exported with ≤ 2 tweaks
- **Fallback rate:** % of generations that hit the rule-based fallback (target < 2%)
- **Return rate:** % of users creating a second vlog within 7 days
