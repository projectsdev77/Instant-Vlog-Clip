# Handoff: Instant Vlog Clip — "Ember" app redesign

## Overview
A full visual redesign of Instant Vlog Clip, the browser app that turns a user's phone clips plus a few lines of story into a narrated, captioned mini vlog. It covers every screen and state from the original design brief: Home, the five-step flow (Clips → Script → Voice → Make → Edit), the Export sheet and the Sign-in sheet. It works at phone width (390px) and on desktop (up to 1120px of content).

The visual direction is called **Ember**: a near-black UI lit by a warm orange "motion" glow. The orange is used as light, never as a fill behind footage. Users' videos carry the colour.

## About the design files
The files in this bundle are **design references built in HTML**: working prototypes that show the intended look and behaviour. They are not production code to copy. Rebuild these designs in the existing app (`src/`, using its React components and the tokens in `src/index.css`), following its own patterns and libraries. Do not ship the prototype markup itself.

- `Instant Vlog Clip.dc.html` — **the main reference.** A clickable prototype of every screen. Open it in a browser. Its Tweaks panel has: `device` (Desktop / Phone), `startScreen` (jump to any screen), `firstVisit` (Home with no vlogs) and `simulateErrors` (blocked mic, failed Make step, failed export).
- `Design System.dc.html` — the token and component sheet (colour, type, spacing, radius, elevation, surfaces, every component). It also has a paste-ready CSS token block.
- `Home Directions.dc.html` — the Home exploration history. The approved designs are **2a** (desktop) and **4a** (phone); the rest are rejected options.
- `support.js` — the runtime the `.dc.html` files need in order to open. Ignore it when building.

## Fidelity
**High fidelity.** Colours, type, spacing, radii, shadows, copy and interactions are final. Match them pixel for pixel. The cover gradients stand in for real video frames (see Assets).

---

## Design tokens
Put these into `src/index.css`. The table maps the existing token names to the new values.

### Colour (dark theme)
| Existing token | New value | Role |
|---|---|---|
| `--color-bg` | `#09090A` | App background |
| `--color-surface` | `#141313` | Cards, sheets, panels |
| `--color-surface-2` | `#1E1C1B` | Inputs, quiet buttons, chips |
| `--color-border` | `rgba(255,255,255,.08)` | Dividers, input inset rings |
| `--color-fg` | `#FFFFFF` | Main text |
| `--color-muted` | `rgba(255,255,255,.62)` | Secondary text (tertiary: `.45`–`.55`) |
| `--color-accent` | `#FF5A1F` | Commit actions, selection, focus (hover `#FF6A32`) |
| `--color-accent-fg` | `#FFFFFF` | Text on accent |
| `--color-accent-soft` | `rgba(255,90,31,.10)` | Selected card fill (chip-style soft: `.14`–`.16`) |
| `--color-danger` | `#FF4F4F` | Errors, recording, delete (text on it: `#1A0404`) |
| `--color-success` | `#2FBF71` | Done / recorded (icon on it: `#06140B`; soft text `#4FD88D`) |
| `--color-warning` | `#FF5A1F` | The "must include" star now uses the accent |

Ember ramp (new tokens): `--ember-200 #FFA25A` (glow core, caption highlight), `--ember-300 #FF7A3D` (accent text on dark, eyebrows, links), `--ember-500 #FF5A1F` (accent), `--ember-600 #E2440D` (logo glyph), `--ember-700 #C2340A` (accent text on white), `--ember-900 #7A1C03` (glow edge).

Primary button: white `#FFFFFF` with text `#0C0C0C`. Error surface: `#2A1414` with inset ring `rgba(255,79,79,.35)`. Scrim: `rgba(0,0,0,.6)`.

### Type
One family: **Plus Jakarta Sans** (Google Fonts, OFL), weights 400/500/600/700/800. It replaces Inter for `--font-sans`. Numbers use `font-variant-numeric: tabular-nums`.

| Style | Size / line-height / weight / tracking |
|---|---|
| Display (Home hero) | `clamp(46px, 6.6cqw, 84px)` / .96 / 800 / −0.05em |
| Title 1 (screen headings) | `clamp(32px, 3.4cqw, 40px)` / 1.05 / 800 / −0.035em |
| Title 2 (sections, sheets) | 20–26px / 1.15 / 700 / −0.02em |
| Headline | 16px / 1.35 / 600–700 |
| Body L | 18px / 1.55 / 400 |
| Body | 15px / 1.5 / 400–500 |
| Small / meta | 13px / 1.4 / 500, muted |
| Eyebrow | 13px / 600 / uppercase / +0.14em / `#FF7A3D` |

`cqw` means container-query width. The app frame has `container-type: inline-size`. You can use `vw` clamps instead.

### Spacing, radius, elevation, motion
- 4pt spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 56.
- Page gutter: 16px on phone, 40px on desktop. Content `max-width: 1120px`, centred. Touch targets are ≥ 44px.
- Radius: thumbs 10px, inputs 16px, tiles 16px, covers and cards 20px, panels 24px, sheets 28px (phone: top corners only), buttons and chips 999px (always pills).
- Shadows:
  - `--shadow-lift`: `0 14px 34px rgba(0,0,0,.4)`
  - `--shadow-cover`: `0 0 0 1.5px rgba(255,255,255,.2), 0 30px 60px rgba(30,6,0,.55)`
  - `--shadow-ember`: `0 12px 30px rgba(255,90,31,.35)`
  - Focus: `inset 0 0 0 1.5px #FF5A1F, 0 0 0 4px rgba(255,90,31,.18)` on inputs; buttons use `0 0 0 3px #09090A, 0 0 0 5px #FF5A1F`.
- Motion: 160ms, `cubic-bezier(.2,.7,.2,1)`. Hover lifts 1–6px; press scales to .98. With `prefers-reduced-motion`, use opacity changes only and turn off float, sweep and pulse.

### Surfaces
1. **Ember motion:** used on the Home hero and the Make screen only. Layers, from back to front:
   - `radial-gradient(ellipse 75% 85% at 30% 10%, #FFA25A 0%, #FF6A24 26%, #E2440D 46%, #7A1C03 72%, #1A0602 100%)`
   - 1–2px horizontal light streaks: `linear-gradient(90deg, transparent, rgba(255,220,190,.4), transparent)`
   - SVG fractal-noise grain at 22% opacity, `mix-blend-mode: overlay`
   - a 240px fade to `#09090A` at the bottom
2. **Ember wash:** used on flow screens. A faint glow behind the header: `radial-gradient(ellipse at center, rgba(255,106,36,.26), transparent 62%)`, 900×520px, centred at top −120px. No grain.
3. **Base:** everything else.

### Rules
- **Never put orange cover art on an orange surface.** Covers get a white 1.5px ring and a deep shadow so footage stays separate from the glow.
- **One main action per screen.** It's a white pill; on phone it's pinned in thumb reach.
- **Orange solid is only for committing actions:** Make my vlog, Export video, Send.
- Show the privacy line ("Your videos stay on this device.", with a lock icon) on Home, Export and Sign in, next to the main action.

---

## Global layout
- The app frame is full viewport height with internal scroll. On phone the content area is 390px wide.
- **Flow header** (every step screen): sticky, `rgba(9,9,10,.84)` with 14px backdrop blur and a bottom border in the line colour.
  - Desktop: logo tile + "Instant Vlog Clip" on the left, step bar centred, "Demo AI" badge on the right.
  - Phone: logo tile only, then a compact "Step 2 of 5 · Script" label above five 4px progress segments.
  - Phone needs a 52px top safe area.
- **Step bar pills** (40px tall, 15px side padding, 14px text):
  - Current: white fill, dark text, and the step number in `#C2340A`.
  - Done: `#1E1C1B` fill with an orange check. Tapping goes back to that step (Make can't be re-entered).
  - Locked: transparent with a hairline inset ring, text at 40% white.
  - Phone segments: current white, done `#FF5A1F`, locked white at 12%.
- **Sticky footer** (Clips / Script / Voice): pinned to the bottom with a gradient `transparent → #09090A 32%`. The summary text sits on the left, the main button (52px) on the right. Padding is 20/16/30px on phone and 28/40px on desktop.
- **Sheets:** on phone they slide up from the bottom, full width, with 28px top radius and a 36×4px grabber. On desktop they're a centred modal, max 480px, 28px radius. Both sit on `#141313` over a 60% black scrim; tapping the scrim closes the sheet.
- **Toasts:** a `#1E1C1B` pill (errors use the error surface) with a dot, the text and an optional orange **Undo** action. Placed bottom-centre above the footer; shown for about 3.6s.

---

## Screens

### Home `/`
- **Header:** white 36px logo tile (11px radius, `#E2440D` glyph) and "Instant Vlog Clip" (17px/700). On the right: the "Demo AI" badge (desktop only, 34px, black at 28% with a white-22% border) and **Sign in** (white pill, 40px). When signed in, Sign in becomes an email chip with a **Sign out** button.
- **Hero** (on Ember motion, 760px tall; 860px on phone):
  - Headline: "Your clips, made into a vlog." (Display).
  - Subhead: "Add the videos from your day, say what happened, and get a narrated mini vlog with captions and music in about a minute." (18px, white at 92%, max 460px).
  - **New vlog** (desktop): a 62px white pill with an orange 46px circle holding a +. Next to it, the privacy line.
- **Cover fan:** a 520×500px box to the right of the text on desktop. On phone it sits below the text, scaled to 0.64 (box 330px tall).
  - Front cover: 228px wide, 9:16, 26px radius, rotated −2°. It has a blurred copy of itself behind it, a NEW tag (or EXAMPLE on first visit), a 60px play disc, and the title/meta.
  - Two back covers: 186px wide, rotated −11° and +10°.
  - The covers are the latest three vlogs; on first visit they're examples. Tapping one opens it in Edit.
- **How it works:** a three-column grid (`auto-fit, minmax(200px,1fr)`):
  - "#01 Add your clips / Messy is fine. We skip the accidental ones."
  - "#02 Say what happened / Write a few lines, or let AI write them."
  - "#03 Get your vlog / Narrated, captioned and set to music."
- **Your vlogs:** a grid (`auto-fill, minmax(150px,1fr)`, 18px gap) of 9:16 covers with 20px radius. Each shows a duration chip, the title (15px/600, ellipsis), "when" (13px muted) and a 44px "…" button that opens the delete confirm. The last tile is a dashed "New vlog" tile.
  - Empty (first visit): "Your vlogs will show up here" plus an explanation.
- **Phone:** New vlog is a full-width 60px pill pinned to the bottom, with the privacy line under it.
- **Delete sheet:** "Delete this vlog?" / "“Title” will be removed from this device. This can’t be undone." Buttons: **Delete vlog** (danger fill) and Keep it (outline).

### 1 · Clips `/p/:id/clips`
- Eyebrow "Step 1 of 5". Title "Add your clips". Sub "Messy is fine. We skip the shaky and accidental bits."
- **Empty:** a dashed drop zone (28px radius, 340px tall; 360 on phone).
  - 72px orange circle with a camera icon and `--shadow-ember`.
  - "Choose videos" (22px/700).
  - "or drag them here" on desktop, "From your phone’s gallery" on phone.
  - Limits line: "MP4, MOV or WebM · up to 30 clips, 10 minutes, 4 GB".
  - Hover: orange border and a faint orange fill.
- **Tiles** (`auto-fill, minmax(150px,1fr)`; 100px on phone; 12px gap): 9:16, 16px radius, bottom gradient.
  - *Importing:* 72% dark overlay, an orange spinner and "Reading…".
  - *Ready:* 36px star button top-left (black at 50%; starred = orange fill, white star, and a 2px orange ring on the tile), 36px remove × top-right, duration chip bottom-left, and an optional orange "Similar" badge bottom-right.
  - *Error:* `rgba(42,12,12,.9)` overlay with a red disc, "This browser can’t decode this HEVC video." and a Remove button.
  - The last tile is a dashed "Add clips" tile.
- Hint above the grid: "Tap the star on clips that must be in your vlog." (it changes to a count once clips are starred).
- **Footer:** "6 clips · 0:43 of 10:00 max" and **Continue** (disabled until at least one clip is ready: white at 12% fill, 40% text).
- Limit toasts (30 clips / 10 min / 4 GB) use the standard toast.

### 2 · Script `/p/:id/script`
- Eyebrow, "Say what happened", sub "One short line per moment. Each line becomes a scene and is read aloud."
- Two columns that wrap. The main column is `flex: 1 1 520px`; the settings card is `1 1 300px`, max 380px, and sticky on desktop.
- **Title:** a 56px input (17px/600) with help text "Shown big at the start of your vlog."
- **AI card** (`#141313`, 24px radius): "What’s it about? Optional" input, then:
  - With no lines: **Write it for me** (white pill with a sparkle icon).
  - With lines: **Rewrite with AI** and **Polish my lines** (surface-2 pills).
  - Busy: a spinner pill reading "Writing from your clips…" or "Polishing…".
  - Rewriting existing lines first opens a confirm sheet: "Replace your lines?" — Replace lines / Keep mine.
- **Lines:**
  - "Your lines" with "About 0:13 spoken" on the right (word count ÷ 2.6 words per second).
  - Each row: a 6-dot drag handle (28×44), a 52px input, and a 44px remove ×.
  - Enter adds a line after the current one. Placeholder on the first line: "e.g. So here’s a sunny Saturday in the park."
  - "+ Add line" (orange text button). Help: "Press Enter for a new line. Drag the dots to reorder."
- **Settings:** Format (Vertical 9:16, Square 1:1, Wide 16:9), Length (Auto, 15s, 30s, 60s), Vibe (Auto, Chill, Upbeat, Cinematic, Funny, Aesthetic). Chips are 44px; selected is a white fill with dark text, unselected has a 1.5px white-16% inset ring.
- **Footer:** "No script, just music" (text button, skips Voice and goes to Make) and **Continue** (disabled until there is at least one line).

### 3 · Voice `/p/:id/voice`
- Title "Who tells the story?"
- **Mode cards** (3, `auto-fit minmax(240px,1fr)`): 42px icon tile, title, description and a check when selected. Selected: accent-soft fill, 1.5px orange inset ring, orange icon tile.
  - AI voice / "Six natural voices read your lines."
  - Record my own / "Read each line with a teleprompter."
  - No voiceover / "Your lines appear as captions only."
- **AI voice:**
  - Note: "Play reads your first line: “…”".
  - Voice cards (`auto-fill minmax(250px,1fr)`): 44px initial avatar (orange when selected), name with accent tag, description, and a 44px play button.
  - Play button states: play → spinner (loading) → three animated bars (playing).
  - Voices: Ava (American, warm and upbeat), Leo (American, calm, low and easy), Mia (American, bright and friendly), Sam (American, relaxed), Grace (British, soft and clear), Oliver (British, dry, a little witty).
- **Record my own:**
  - Intro text plus an **Open teleprompter** button (white, red dot). It opens at the first unrecorded line.
  - Line rows: number disc (or green check when done), the text, a play button (when done) and a Record/Redo pill (Record = white, Redo = white at 8%).
- **Teleprompter** (full screen over the app):
  - Top bar: close ×, "Line 3 of 7", and a timer (turns red while recording).
  - Previous line faded above, the current line in the middle at `clamp(34px,4.6cqw,56px)`/800, the next line faded below.
  - A 28-bar level meter (orange while recording).
  - An 84px red record button with a 4px white ring. Recording shows a white square and a pulsing halo; saving shows a spinner.
  - Previous / Skip text buttons.
  - Status text: "Tap the button and read the line." / "Recording. Tap to stop." / "Saving your take…"
  - After each take it moves to the next unrecorded line; after the last one it closes with the toast "All lines recorded."
  - Microphone blocked: error toast "Microphone blocked. Allow it in your browser’s site settings, then try again."
- **No voiceover:** an info card with a small caption sample: "Captions do the talking."
- **Footer:** the summary ("Ava · warm and upbeat" / "2 of 7 lines recorded" / "Captions only, no voiceover") and **Make my vlog** (orange; disabled in Record mode until every line is recorded).

### 4 · Make `/p/:id/generate`
- Full Ember motion background, with two light streaks drifting sideways (`translateX ±30%`, 3.2s and 4.4s, alternating).
- A centred column, max 560px:
  - Four clip thumbnails (96px wide; 78px on phone), rotated −9° / 4° / −3° / 8°, floating 14px up and down over 3s with staggered delays.
  - "MAKING YOUR VLOG" eyebrow, then the vlog title (`clamp(30px,3.6cqw,44px)`/800).
  - A glass card (`rgba(9,9,10,.66)` with 16px blur) containing a 6px progress bar (`#E2440D → #FFA25A`) and five stages.
- Stages: Watching your clips ("3 of 6 clips") → Voicing your script ("2 of 7 lines"; "Cleaning up your recordings" in Record mode, "Timing your captions" with no voiceover) → Picking the best moments → Cutting it together → Adding captions & music.
- Stage icons: done = green check disc; current = orange spinner ring with the label in bold; waiting = dim disc; failed = red × disc.
- **Error:** an error-surface card with a plain message, e.g. "We couldn’t finish “voicing your script”. The voice service didn’t answer in time. Nothing was lost." Buttons: **Try again** (resumes) and Go back.
- On success it moves straight to Edit and starts playing.
- Foot note: "Usually under a minute. Everything happens on this device."
- If a guest has run out of free vlogs, open the Sign-in sheet here.

### 5 · Edit `/p/:id/edit`
- **Toolbar:**
  - Undo and Redo: 44px round buttons with a white-14% border; disabled = 30% icon.
  - Version note: "Version 3 · “open with the sunset”" (13px muted, ellipsis).
  - **Export video** (orange, desktop only).
- **Layout** (wraps on phone):
  - Preview column, 340px, sticky at top 90px.
  - Panel column, `flex: 1 1 420px`.
- **Preview:**
  - 9:16 frame, 320px wide (230px on phone), 24px radius, 1.5px white-14% ring with a deep shadow. The background is the current scene's footage.
  - The **title** shows for the first 3s at 11% from the top, 10% of frame width, in the selected preset style.
  - **Captions** sit at 66% from the top, 7.2% of frame width, centred, inside 84% of the width. They show up to 4 words at a time, and the word being spoken uses the highlight colour.
  - A play disc shows when paused.
  - Controls: a 40px white play/pause, a 4px scrub track (`#FF5A1F` fill; click to seek) and "0:04 / 0:14".
- **Panel tabs:** a segmented pill on `#141313`, four 44px items — Scenes, Voice, Music, Style. Selected = white.
  - **Scenes:** one card per script line.
    - Each card has a 48px 9:16 thumb, the line (15px/600), a mini strip of every shot (14×20px each — fixes "only the first shot shows"), "2.0s · 2 shots", the scene number and a chevron.
    - The scene currently playing gets an orange inset ring and the accent-soft fill.
  - **Voice:** voice rows (selected = accent-soft + ring + check) and a Voice volume slider. In Record mode, a note: "You’re using your own recordings. Pick a voice below to switch to AI."
  - **Music:** Sunny Day (upbeat acoustic), Lo-fi Walk, Golden Hour, City Pop, Soft Piano, No music. Plus a volume slider and "Music dips under your voice automatically."
  - **Style:** a Title input ("Shows for the first 3 seconds.") and caption preset cards (`auto-fill minmax(150px,1fr)`). Each card shows a sample "so here’s a **sunny**" over footage.
- **Scene editor:** opens in place of the tabs, so the preview stays visible (fixes "the sheet covers the preview").
  - Header: "‹ All scenes" with "Scene 3 of 7".
  - Narration input. Help: "Changing this re-voices just this line." Changing it creates a new version.
  - Shots: thumb, "Shot 1", time range, and a **Clip sound** segmented control: Off / Quiet / Full.
  - "Swap for another good moment": a 6-up grid of alternatives; the current one has an orange ring.
  - Trim: Start / End sliders, with at least 10% of the shot kept.
  - Move earlier / Move later (disabled at the ends) and **Delete scene** (red text; toast with Undo).
  - Phone: the preview shrinks to 120px and stays pinned at the top while the editor scrolls underneath.
- **Tell the AI:**
  - Desktop: a sticky bar at the bottom of the panel (`rgba(20,19,19,.92)` with blur, 24px radius). A 52px input pill with a sparkle icon and the placeholder "Tell the AI: “open with the sunset”", a 44px orange Send button (spinner while working), and suggestion chips: Open with the sunset · Make it punchier · Slow it down · Louder music.
  - Phone: the bottom bar holds **Tell the AI** (surface-2 pill, fills the remaining width) and **Export** (orange). Tell the AI opens a sheet with the same input and chips, plus the note "Each change is a new version. Undo takes you back." (fixes the tabs and the AI bar competing for space).
  - Every AI request makes a new version and shows the toast "Done: …" with Undo.

### Caption presets (drawn into the exported video)
| Preset | Weight | Case | Text | Highlight | Legibility |
|---|---|---|---|---|---|
| **Ember** (default, new) | 800 | Sentence | `#FFFFFF` | `#FFA25A` | Box `rgba(0,0,0,.6)`, padding .12em .42em, radius .35em |
| Classic | 800 | Title caps | `#FFFFFF` | `#FFD84D` | Outline: `0 0 2px rgba(0,0,0,.85)` ×2 + `0 2px 6px rgba(0,0,0,.85)` |
| Bold | 800 | ALL CAPS | `#FFFFFF` | `#4DFF9A` | Heavier outline: `0 0 2px #000, 0 0 3px #000, 0 2px 6px rgba(0,0,0,.95)` |
| Minimal | 600 | Sentence | `#FFFFFF` | none | Soft `0 1px 8px rgba(0,0,0,.45)` |
| Box | 800 | Title caps | `#111111` | `#E0218A` | White box behind each line |

All presets use Plus Jakarta Sans. The title is 10% of frame width, centred at 15%, wraps to 3 lines and fades in 0.25s / out 0.35s. Captions are 7.2% of frame width at 70%, with up to 4 words or 22 characters per chunk. Keep everything inside the platform safe zones from the original brief.

### Export sheet
- **Ready:**
  - A summary row: a 54px cover, the title, "1080×1920 · 30 fps · MP4" and "0:14 · about 3 MB".
  - The privacy line "Made on this device. Nothing is uploaded."
  - **Export video** (orange, 56px).
- **Rendering:** a large "45%" (44px/800), a gradient progress bar, "Keep this tab open. A 30-second vlog takes about half a minute." and Cancel (outline).
- **Done:** a 170px playable cover, a green "Ready · 3.1 MB" badge, then the buttons.
  - Phone: **Share** (white; opens the native share sheet) and Save to Photos (outline).
  - Desktop: **Download video** and Share….
- **Error:** an error-surface message, e.g. "Export stopped at 60%. Your browser ran low on memory. Close other tabs and try again." Then **Try again**.
- Closing during rendering cancels the export.

### Sign-in sheet
- **Enter email:**
  - Title "Sign in to keep going".
  - Body: "Guests get one free vlog. Sign in with your email to keep making them. Your videos still stay on this device."
  - A 56px email input, **Send sign-in link** (white) and Continue with Google (outline; only when that option is turned on).
- **Sending:** a spinner in the button and the label "Sending…".
- **Error:** the input gets a 1.5px red ring and "That doesn’t look like an email address." Validation: `^[^@\s]+@[^@\s]+\.[^@\s]+$`. Typing clears the error.
- **Sent:** title "Check your email", a mail icon in an orange-soft disc, "We sent a sign-in link to **email**. Open it on this device." and "Use a different email". (The prototype's "Demo: open the link" button stands in for the magic link.)
- **Signed in:** the Home header shows the email and Sign out.

---

## Interactions and behaviour (summary)
- Navigation: Home → Clips → Script → Voice → Make → Edit. Steps already reached can be revisited from the step bar, except Make. "No script" goes from Script straight to Make.
- Tapping the logo goes to Home.
- Clips import one by one (per-tile spinner). A starred clip means "must include".
- Undo and redo walk through a list of versions. A new version is made by: an AI request, a narration rewrite, a swap, a move or a delete. Trim, clip sound, voice, music and style edit the current version in place.
- Edit starts playing right away. Playback loops through the scenes; the captions follow the current word.
- Spinners: 0.9s linear rotation. Teleprompter pulse: 1.4s ease-out halo. Make: floating thumbnails (3s ease-in-out) and streak sweep. Turn all of these off for reduced motion.

## State (from the prototype)
`screen`, `reached` (furthest step), `clips[] {id, state: importing|ready|error, secs, starred, similar}`, `title`, `about`, `lines[]`, `aiBusy`, `format / length / vibe`, `noScript`, `voiceMode: ai|record|none`, `voice`, `recorded[]`, `tele {i, phase: idle|rec|saving, secs}`, `make {stage, sub, failed}`, `versions[] {scenes[], note}` + `vi`, `scene {line, dur, start%, end%, shots[] {sound: off|quiet|full}}`, `t / playing`, `tab`, `sceneOpen`, `music / musicVol / voiceVol`, `preset`, `sheet: export|signin|del|replace|ai`, `exp: ready|rendering|done|error` + `pct`, `signin: enter|sending|sent|error`, `signedIn`, `toast {text, tone, action}`.

## Assets
- No images. In the prototype, the covers, clips and video frames are CSS gradient placeholders (named in the design sheet as Daylight, Overcast, Mono, Golden hour, Sea, Night). Replace them with real decoded video frames.
- Icons are simple inline 24px stroke SVGs (2–2.6px stroke, round caps/joins): play, plus, lock, star, ×, check, sparkle, mic, waveform, captions, music note, undo/redo, send, trash, mail, chevrons, drag dots. Swap in the app's icon set if it has one, keeping the same weights.
- Logo: a white 34–36px tile (11px radius) with a `#E2440D` film-strip glyph. This is a placeholder until branding arrives; use the same mark for the app icon and favicon.
- Font: Plus Jakarta Sans from Google Fonts.

## Not yet designed
- Light theme. The plan is to flip bg/surface to warm off-whites and keep the Ember ramp unchanged.
- Motion notes beyond the above, for the scene-change and export-complete moments.
