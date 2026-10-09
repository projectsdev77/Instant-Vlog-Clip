import type { AnalyzeClipRequest, CatalogEntry, PlanRequest, ScriptRequest } from './contracts.ts'

// System prompts are static so they stay prompt-cached between requests.

export const ANALYZE_SYSTEM = `You help a video app turn people's phone clips into short vlogs.

You get one clip as a contact sheet: frames sampled across the clip, in reading order, each labelled with its timestamp in seconds. Describe what's in the clip and find its best moments.

- description: one concrete, visual sentence ("Latte art being poured into a white cup on a wooden table"). No guesses about who people are.
- tags: 3-8 short lowercase nouns useful for matching narration to footage (places, objects, activities, mood).
- shotType: talking_head if someone talks to the camera; pov for first-person movement; closeup, wide, pan or other otherwise.
- quality flags: shaky, blurry, dark, accidental (pocket shot, floor, finger over lens, nothing happening).
- moments: 1-5 ranges (start/end in seconds, inside 0..duration) that would look good in a vlog, best first. 1.5-6 s each, avoiding blurry or empty frames. score 0-1. why: a few words. focusX/focusY: where the main subject sits in the frame (0-1), used to crop the shot.
If the whole clip is unusable, still return one moment with a low score.`

export function analyzeUserText(req: AnalyzeClipRequest): string {
  return [
    `File name: ${req.fileName}`,
    `Duration: ${req.durationSec.toFixed(2)} s`,
    `Frame timestamps (s): ${req.frameTimes.map((t) => t.toFixed(1)).join(', ')}`,
    `Share of the clip with speech: ${Math.round(req.speechRatio * 100)}%`,
    req.transcript ? `What is said on camera: "${req.transcript}"` : 'No speech transcript.',
  ].join('\n')
}

export const SCRIPT_SYSTEM = `You write narration for short personal vlogs (TikTok, Reels, Shorts), told in the first person by the person who filmed the clips.

Style:
- Sounds like a real creator talking to friends, not an ad or a travel brochure. Casual, warm, specific.
- One short spoken sentence per line, at most 15 words. Contractions are good.
- The first line is a hook that makes people keep watching ("So I gave myself 24 hours in Lisbon…").
- The last line is an outro: a feeling, a punchline, or a question to the viewer.
- Only describe things the footage actually shows (use the clip catalog). Never invent people, places or events that aren't in the clips or the user's notes.
- Every clip marked mustInclude must be covered by a line.
- Roughly 2.5 spoken words per second of video. Aim for the target length; with "auto", fit the footage (usually 20-45 s, 4-9 lines).
- title: 2-5 words, shown big on screen ("MY DAY IN NYC" style, but write it in normal case).
- visualIntent: what footage should play under the line, referencing what's in the catalog.
- onScreenText: usually empty; only for a short label that adds something (a place name, a price).

Polish mode: the user wrote their own lines. Keep their meaning, facts, order and personality; fix grammar, make each line speakable and natural, split or merge lines only when needed, add a hook only if the first line has none.`

export function scriptUserText(req: ScriptRequest): string {
  const parts = [
    `Mode: ${req.mode}`,
    `Language: ${req.language}`,
    `Target length: ${req.targetSec === 'auto' ? 'auto' : `${req.targetSec} seconds`}`,
    `Vibe: ${req.vibe}`,
  ]
  if (req.title) parts.push(`Title the user chose: ${req.title}`)
  if (req.prompt) parts.push(`What the vlog is about (from the user): ${req.prompt}`)
  if (req.lines.length) parts.push(`User's lines:\n${req.lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`)
  parts.push(`Clip catalog (in filming order):\n${catalogText(req.catalog)}`)
  return parts.join('\n\n')
}

export const PLAN_SYSTEM = `You are the editor of a short vertical vlog. You pick which footage plays under each line of narration.

Output one scene per narration line, in the same order, each with 1-3 shots. Rules:
- A scene's shots must add up to its sceneSec (the narration's length). Shots are ranges [in, out] in seconds inside a clip from the catalog, within 0..durationSec.
- Shots are 0.8-6 s. Talking-to-camera clips may run longer.
- Match footage to the line's meaning and visualIntent. Prefer high-scoring moments; never use clips marked unusable unless nothing else fits.
- Don't reuse the same footage twice. Spread usage across clips; every mustInclude clip appears.
- The first scene should be visually strong (it carries the hook).
- clipAudio: "mute" under narration by default, "duck" for nice ambient sound, "full" only for a talking_head clip whose own speech should be heard (narration doesn't cover it).
- transitionIn: "cut" by default. Chill/cinematic vibes may use "crossfade" between scenes; upbeat uses quick cuts and an occasional "whip". The first shot is always "cut".
- focusX/focusY: copy the subject position from the moment; it's used to crop horizontal footage to vertical.
- note: one short friendly sentence about the edit ("Opened on the skyline, kept the bike ride fast").

With no narration lines, make scenes with empty lineId that add up to targetSec, in filming order, paced by the vibe.

If the user gives feedback about the current plan, change what they asked for and keep the rest. If previous issues are listed, fix them.`

export function planUserText(req: PlanRequest): string {
  const parts = [`Aspect: ${req.aspect}`, `Vibe: ${req.vibe}`, `Narrated: ${req.narrated ? 'yes' : 'no'}`]
  if (req.lines.length) {
    parts.push(
      `Narration lines:\n${req.lines.map((l) => `- lineId=${l.lineId} sceneSec=${l.sceneSec.toFixed(2)} text="${l.text}" visualIntent="${l.visualIntent}"`).join('\n')}`,
    )
  } else {
    parts.push(`No narration. Target length: ${req.targetSec} s`)
  }
  parts.push(`Clip catalog (in filming order):\n${catalogText(req.catalog)}`)
  if (req.currentPlan) parts.push(`Current plan:\n${JSON.stringify(req.currentPlan)}`)
  if (req.feedback) parts.push(`User feedback on the current plan: "${req.feedback}"`)
  if (req.previousIssues?.length) parts.push(`Problems with your previous answer (fix these):\n- ${req.previousIssues.join('\n- ')}`)
  return parts.join('\n\n')
}

export function catalogText(catalog: CatalogEntry[]): string {
  return catalog
    .map((c) => {
      const flags = [c.mustInclude && 'mustInclude', c.unusable && 'unusable'].filter(Boolean).join(', ')
      const moments = c.moments.map((m) => `[${m.start.toFixed(1)}-${m.end.toFixed(1)}s score ${m.score.toFixed(2)}: ${m.why}]`).join(' ')
      return `- clipId=${c.clipId} durationSec=${c.durationSec.toFixed(2)} shotType=${c.shotType}${flags ? ` (${flags})` : ''}\n  ${c.description} | tags: ${c.tags.join(', ')}\n  moments: ${moments}${c.transcript ? `\n  says: "${c.transcript}"` : ''}`
    })
    .join('\n')
}

// ---------------------------------------------------------------------------
// Gemini checklists. Faster models follow rules better when the key ones are
// restated right before they answer, with the request's own numbers filled
// in. Sent as the last part of the request (Gemini only).

export function analyzeChecklist(req: AnalyzeClipRequest): string {
  const d = req.durationSec.toFixed(1)
  return [
    'Before answering, check:',
    `- every moment has 0 ≤ start < end ≤ ${d} (seconds, read from the frame labels), is 1.5–6 s long, and doesn't overlap another moment`,
    '- moments are ordered best first; score is between 0 and 1',
    '- tags are 3–8 lowercase single words about places, objects and activities',
    '- the description says what is visible; refer to people as "a person", "two friends" etc., never guess who they are, their age or ethnicity',
    '- flag accidental only for pocket shots, floor/ceiling, a finger over the lens or nothing happening',
  ].join('\n')
}

const SCRIPT_EXAMPLE = `Example of the style (different footage, don't reuse it):
title: "Sunday in Lisbon"
1 hook:  "So I gave myself one lazy Sunday in Lisbon…"
2 story: "Started with the best pastel de nata of my life."
3 story: "Then took the old yellow tram all the way up the hill."
4 outro: "Honestly? I'd do it all again tomorrow."`

export function scriptChecklist(req: ScriptRequest): string {
  const words = req.targetSec === 'auto' ? 'fit the footage, usually 50–110 words in total' : `about ${Math.round(req.targetSec * 2.5)} words in total`
  const must = req.catalog.filter((c) => c.mustInclude).map((c) => c.clipId)
  return [
    SCRIPT_EXAMPLE,
    '',
    'Before answering, check:',
    '- first person, casual spoken English, each line ≤ 15 words; no hashtags, emojis or quotes around lines',
    `- length: ${words}`,
    '- the first line is a hook (purpose "hook"), the last is an outro (purpose "outro"), the rest "story"',
    "- only things the catalog or the user's notes mention; no invented people, places or events",
    must.length ? `- these must-include clips each get a line: ${must.join(', ')}` : '- (no must-include clips)',
    req.mode === 'polish' ? "- polish mode: keep the user's facts, order and voice; only fix wording" : '- write mode: build a small story arc in the order things were filmed',
    '- onScreenText is "" unless it adds a place name or price',
  ].join('\n')
}

export function planChecklist(req: PlanRequest): string {
  const ids = req.catalog.map((c) => `${c.clipId} (0–${c.durationSec.toFixed(1)}s)`).join(', ')
  const scenes = req.lines.length
    ? req.lines.map((l, i) => `  ${i + 1}. lineId ${l.lineId}: shots add up to ${l.sceneSec.toFixed(2)}s`).join('\n')
    : `  scenes with lineId "" adding up to about ${req.targetSec}s`
  return [
    'Before answering, check:',
    `- allowed clipIds, copied exactly, with their lengths: ${ids}`,
    `- scenes, in this order:\n${scenes}`,
    '- every shot has 0 ≤ in < out ≤ its clip length; do the subtraction (out − in) for each shot and make each scene add up',
    '- no two shots use overlapping time ranges of the same clip',
    '- the very first shot has transitionIn "cut"',
    '- prefer clips whose description matches each line; avoid clips marked unusable',
  ].join('\n')
}
