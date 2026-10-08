import type { Clip, Moment } from './types'

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function normalize(values: number[]): number[] {
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values.map((v) => (v - min) / span)
}

/** Ranks windows of a clip from on-device signals (used when AI analysis is missing). */
export function momentsFromSignals(clip: Clip, maxMoments = Math.max(2, Math.min(6, Math.ceil(clip.durationSec / 3)))): Moment[] {
  const s = clip.signals
  const dur = clip.durationSec
  if (!s || s.sampleTimes.length === 0) return evenMoments(clip, maxMoments)

  const sharp = normalize(s.sharpness)
  const frameScore = s.sampleTimes.map((_, i) => {
    const b = s.brightness[i] ?? 0.5
    const brightnessOk = 1 - Math.min(1, Math.abs(b - 0.5) * 2) // best near mid-grey
    const m = s.motion[i] ?? 0
    const motionOk = m < 0.02 ? 0.5 : m > 0.35 ? 0.3 : 1 // some motion is good, chaos is bad
    return 0.5 * sharp[i] + 0.25 * brightnessOk + 0.25 * motionOk
  })

  const win = Math.min(dur, Math.max(1.5, Math.min(4, dur * 0.4)))
  const windows: Moment[] = []
  for (let start = 0; start + win <= dur + 1e-6; start += Math.max(0.5, win / 2)) {
    const idx = s.sampleTimes.map((t, i) => (t >= start && t <= start + win ? i : -1)).filter((i) => i >= 0)
    const score = idx.length ? idx.reduce((a, i) => a + frameScore[i], 0) / idx.length : 0.3
    windows.push({ start, end: Math.min(dur, start + win), score: clamp01(score), why: 'Sharp, well-lit section', focus: { x: 0.5, y: 0.5 } })
  }
  windows.sort((a, b) => b.score - a.score)
  const picked: Moment[] = []
  for (const w of windows) {
    if (picked.every((p) => w.end <= p.start || w.start >= p.end)) picked.push(w)
    if (picked.length >= maxMoments) break
  }
  return picked.length ? picked : evenMoments(clip, maxMoments)
}

/** No signals at all: split the clip into even windows, earlier ones first. */
function evenMoments(clip: Clip, maxMoments: number): Moment[] {
  const win = Math.min(clip.durationSec, 4)
  const count = Math.max(1, Math.min(maxMoments, Math.floor(clip.durationSec / win)))
  return Array.from({ length: count }, (_, i) => ({
    start: i * win,
    end: Math.min(clip.durationSec, (i + 1) * win),
    score: 0.4 - i * 0.01,
    why: 'Section of the clip',
    focus: { x: 0.5, y: 0.5 },
  }))
}

/** Moments for a clip with quality penalties applied, clamped to clip bounds. */
export function rankedMoments(clip: Clip): Moment[] {
  const base = clip.analysis?.moments?.length ? clip.analysis.moments : momentsFromSignals(clip)
  let penalty = 1
  const q = clip.analysis?.quality
  if (q?.accidental) penalty *= 0.15
  if (q?.blurry) penalty *= 0.6
  if (q?.dark) penalty *= 0.7
  if (q?.shaky) penalty *= 0.8
  if (clip.signals?.duplicateOf) penalty *= 0.5
  return base
    .map((m) => {
      const start = Math.max(0, Math.min(m.start, clip.durationSec))
      const end = Math.max(start, Math.min(m.end, clip.durationSec))
      return {
        ...m,
        start,
        end,
        score: clamp01(m.score) * penalty,
        focus: { x: clamp01(m.focus?.x ?? 0.5), y: clamp01(m.focus?.y ?? 0.5) },
      }
    })
    .filter((m) => m.end - m.start > 0.2)
    .sort((a, b) => b.score - a.score)
}
