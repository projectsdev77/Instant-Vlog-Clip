import { uid } from './ids'
import { round, sumShots } from './shots'
import type { EditPlan, Scene, ScriptLine, VoiceTake, Word } from './types'

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

/**
 * "Say my own thing": the script becomes what was said. Each scene a
 * transcribed take covers gets the words spoken inside it as its line (a new
 * line for a footage-only scene; no line if nothing was said there). Scenes
 * no take covers keep their line. Scene lengths never change.
 * `changed` lists the scenes whose line is new or different.
 */
export function scriptFromSpeech(plan: EditPlan, lines: ScriptLine[], takes: VoiceTake[]): { scenes: Scene[]; lines: ScriptLine[]; changed: number[] } {
  const segments = resolveTakes(takes.filter((t) => t.transcript === 'done'))
  const words = trackWords(segments)
  const byId = new Map(lines.map((l) => [l.id, l]))
  const changed: number[] = []
  let start = 0
  const scenes = plan.scenes.map((scene, i) => {
    const end = start + sumShots(scene.shots)
    const from = start
    start = end
    // Only parts that were actually recorded over (at least a little) are rewritten.
    const covered = segments.some((g) => Math.min(g.end, end) - Math.max(g.start, from) > Math.min(0.5, (end - from) / 2))
    if (!covered) return scene
    const said = words
      .filter((w) => (w.start + w.end) / 2 >= from && (w.start + w.end) / 2 < end)
      .map((w) => w.word)
      .join(' ')
      .trim()
    const old = scene.lineId ? byId.get(scene.lineId) : undefined
    if (!said) {
      if (old) changed.push(i)
      return old ? { ...scene, lineId: undefined } : scene
    }
    if (old?.text === said) return scene
    changed.push(i)
    if (old) {
      byId.set(old.id, { ...old, text: said, visualIntent: said })
      return scene
    }
    const line: ScriptLine = { id: uid('ln_'), text: said, purpose: 'story', visualIntent: said }
    byId.set(line.id, line)
    return { ...scene, lineId: line.id }
  })
  // The script follows the scenes; lines no scene uses any more are dropped.
  const nextLines = scenes.flatMap((s) => (s.lineId && byId.get(s.lineId) ? [byId.get(s.lineId)!] : []))
  return { scenes, lines: nextLines, changed }
}
