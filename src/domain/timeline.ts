import { shotLength } from './shots'
import { hasFreshAudio, LINE_LEAD_IN, lineWords } from './timing'
import type { Clip, EditPlan, Script, ScriptLine, Shot, VoiceMode, Word } from './types'

export type TimelineShot = {
  shot: Shot
  clip: Clip
  sceneIndex: number
  /** output time, seconds */
  start: number
  end: number
  /** previous shot, for transitions that blend into it */
  prev?: TimelineShot
}

export type TimelineVoice = { lineId: string; start: number; mediaKey: string; durationSec: number }

export type CaptionChunk = { start: number; end: number; words: Word[] }

export type TimelineScene = { start: number; end: number; lineId?: string; onScreenText?: string }

export type Timeline = {
  duration: number
  shots: TimelineShot[]
  scenes: TimelineScene[]
  voice: TimelineVoice[]
  captions: CaptionChunk[]
  title: { text: string; until: number }
  /** [start, end] ranges where narration plays, for music ducking */
  speech: [number, number][]
}

export const TRANSITION_SEC = 0.35

export function buildTimeline(plan: EditPlan, clips: Map<string, Clip>, script: Script | undefined, voiceMode: VoiceMode): Timeline {
  const lines = new Map<string, ScriptLine>((script?.lines ?? []).map((l) => [l.id, l]))
  const shots: TimelineShot[] = []
  const scenes: TimelineScene[] = []
  const voice: TimelineVoice[] = []
  const captions: CaptionChunk[] = []
  const speech: [number, number][] = []
  let t = 0

  plan.scenes.forEach((scene, sceneIndex) => {
    const sceneStart = t
    for (const shot of scene.shots) {
      const clip = clips.get(shot.clipId)
      if (!clip) continue
      const len = shotLength(shot)
      const ts: TimelineShot = { shot, clip, sceneIndex, start: t, end: t + len, prev: shots[shots.length - 1] }
      shots.push(ts)
      t += len
    }
    const line = scene.lineId ? lines.get(scene.lineId) : undefined
    scenes.push({ start: sceneStart, end: t, lineId: scene.lineId, onScreenText: line?.onScreenText })
    if (!line) return
    const speechStart = sceneStart + LINE_LEAD_IN
    if (voiceMode !== 'none' && hasFreshAudio(line)) {
      voice.push({ lineId: line.id, start: speechStart, mediaKey: line.audio!.mediaKey, durationSec: line.audio!.durationSec })
      speech.push([speechStart, speechStart + line.audio!.durationSec])
    }
    const ws = lineWords(line, voiceMode).map((w) => ({ ...w, start: w.start + speechStart, end: w.end + speechStart }))
    captions.push(...chunkWords(ws, t))
  })

  const titleUntil = plan.title.showUntilSec === 'always' ? t : Math.min(t, plan.title.showUntilSec)
  return { duration: t, shots, scenes, voice, captions, title: { text: plan.title.text, until: titleUntil }, speech }
}

/** Groups words into short caption chunks that read well on a phone. */
export function chunkWords(ws: Word[], sceneEnd: number, maxWords = 4, maxChars = 22): CaptionChunk[] {
  const chunks: CaptionChunk[] = []
  let cur: Word[] = []
  const flush = () => {
    if (cur.length) chunks.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur })
    cur = []
  }
  for (const w of ws) {
    const len = cur.reduce((a, x) => a + x.word.length + 1, 0) + w.word.length
    if (cur.length && (cur.length >= maxWords || len > maxChars)) flush()
    cur.push(w)
    if (/[.!?,;:…]$/.test(w.word)) flush()
  }
  flush()
  // Each chunk stays up until the next one starts (or the scene ends).
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1]
    chunks[i].end = next ? next.start : Math.min(sceneEnd, chunks[i].end + 0.6)
  }
  return chunks
}

export function shotAt(tl: Timeline, t: number): TimelineShot | undefined {
  // binary search
  let lo = 0
  let hi = tl.shots.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const s = tl.shots[mid]
    if (t < s.start) hi = mid - 1
    else if (t >= s.end) lo = mid + 1
    else return s
  }
  return tl.shots[tl.shots.length - 1]
}

export function captionAt(tl: Timeline, t: number): CaptionChunk | undefined {
  return tl.captions.find((c) => t >= c.start && t < c.end)
}

export function isSpeaking(tl: Timeline, t: number): boolean {
  return tl.speech.some(([a, b]) => t >= a && t <= b)
}
