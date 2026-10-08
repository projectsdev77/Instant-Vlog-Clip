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
