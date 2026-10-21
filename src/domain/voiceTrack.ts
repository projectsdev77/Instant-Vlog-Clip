import { uid } from './ids'
import { round } from './shots'
import type { VoiceTake, Word } from './types'

/** Seconds of the recording a take uses (= its length on the timeline). */
export const takeLength = (t: VoiceTake) => Math.max(0, t.out - t.in)
export const takeEnd = (t: VoiceTake) => t.start + takeLength(t)

/** A playable piece of a take after overlaps are resolved. */
export type TakeSegment = { take: VoiceTake; start: number; end: number; /** offset into the recording */ offset: number }

/**
 * Where takes overlap, the newer take wins: older takes are cut around it.
 * Returns non-overlapping segments sorted by start.
 */
export function resolveTakes(takes: VoiceTake[]): TakeSegment[] {
  let segs: TakeSegment[] = []
  for (const take of [...takes].sort((a, b) => a.createdAt - b.createdAt)) {
    const s = take.start
    const e = takeEnd(take)
    if (e - s < 0.01) continue
    const next: TakeSegment[] = []
    for (const g of segs) {
      if (g.end <= s || g.start >= e) {
        next.push(g)
        continue
      }
      if (g.start < s) next.push({ ...g, end: s })
      if (g.end > e) next.push({ ...g, start: e, offset: g.offset + (e - g.start) })
    }
    next.push({ take, start: s, end: e, offset: take.in })
    segs = next.filter((g) => g.end - g.start > 0.02)
  }
  return segs.sort((a, b) => a.start - b.start)
}

/** Words spoken in the resolved segments, on the vlog's timeline. */
export function trackWords(segments: TakeSegment[]): Word[] {
  const out: Word[] = []
  for (const g of segments) {
    for (const w of g.take.words ?? []) {
      // keep words whose middle falls inside the used part of this segment
      const mid = (w.start + w.end) / 2
      if (mid < g.offset || mid > g.offset + (g.end - g.start)) continue
      const shift = g.start - g.offset
      out.push({ word: w.word, start: round(w.start + shift), end: round(w.end + shift) })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/** Splits a take at timeline time `t` (no-op if `t` isn't inside it). */
export function splitTake(take: VoiceTake, t: number): VoiceTake[] {
  const cut = take.in + (t - take.start)
  if (t <= take.start + 0.05 || t >= takeEnd(take) - 0.05) return [take]
  return [
    { ...take, out: round(cut) },
    { ...take, id: uid('t_'), start: round(t), in: round(cut), createdAt: take.createdAt + 1e-3 },
  ]
}

/** Moves a take's left or right edge to timeline time `t`, inside the recording. */
export function trimTake(take: VoiceTake, edge: 'in' | 'out', t: number): VoiceTake {
  const min = 0.15
  if (edge === 'in') {
    const newIn = Math.max(0, Math.min(take.out - min, take.in + (t - take.start)))
    return { ...take, start: round(take.start + (newIn - take.in)), in: round(newIn) }
  }
  const newOut = Math.max(take.in + min, Math.min(take.durationSec, take.in + (t - take.start)))
  return { ...take, out: round(newOut) }
}

export const moveTake = (take: VoiceTake, start: number): VoiceTake => ({ ...take, start: round(Math.max(0, start)) })

/** Loudness envelope of a decoded recording, ~40 values per second, 0..1. */
export function peaksOf(data: Float32Array, sampleRate: number, perSecond = 40): number[] {
  const step = Math.max(1, Math.round(sampleRate / perSecond))
  const out: number[] = []
  let max = 0
  for (let i = 0; i < data.length; i += step) {
    let p = 0
    for (let j = i; j < Math.min(data.length, i + step); j++) p = Math.max(p, Math.abs(data[j]))
    out.push(p)
    max = Math.max(max, p)
  }
  return out.map((p) => round(max > 0 ? p / max : 0))
}
