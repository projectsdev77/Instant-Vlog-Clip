import { uid } from './ids'
import { rankedMoments } from './moments'
import { targetTotalSec, vibeShotLength, vibeTransition, type PlanContext } from './planContext'
import { fitShots, isTalking, shotFromMoment, sumShots } from './shots'
import { lineSceneDuration } from './timing'
import type { Clip, ClipAudioMode, EditPlan, Moment, Scene, ScriptLine, Shot } from './types'

type Candidate = { clip: Clip; moment: Moment }

const STOP = new Set(['the', 'a', 'an', 'and', 'then', 'i', 'my', 'we', 'to', 'of', 'in', 'on', 'at', 'with', 'so', 'it', 'was', 'for', 'this', 'that'])

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  )
}

function relevance(line: ScriptLine, clip: Clip): number {
  const want = keywords(`${line.text} ${line.visualIntent}`)
  if (!want.size) return 0
  const have = keywords(`${clip.analysis?.description ?? ''} ${(clip.analysis?.tags ?? []).join(' ')} ${clip.fileName}`)
  let hits = 0
  for (const w of want) if (have.has(w)) hits++
  return hits / want.size
}

function chronological(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => (a.recordedAt ?? '').localeCompare(b.recordedAt ?? '') || a.addedAt - b.addedAt)
}

export function audioModeFor(clip: Clip, narrated: boolean): ClipAudioMode {
  if (isTalking(clip)) return narrated ? 'duck' : 'full'
  return narrated ? 'mute' : 'duck'
}

/**
 * Rule-based edit used when the AI planner is unavailable or returns something
 * unusable. Always produces a playable plan as long as there is one clip.
 */
export function planFallback(ctx: PlanContext): EditPlan {
  const clips = chronological(ctx.clips.filter((c) => c.durationSec > 0.3))
  const byId = new Map(clips.map((c) => [c.id, c]))
  const candidates: Candidate[] = clips.flatMap((clip) => rankedMoments(clip).map((moment) => ({ clip, moment })))
  const usedClips = new Map<string, number>()
  const usedRanges: Shot[] = []
  const narrated = ctx.voiceMode !== 'none'
  const transition = vibeTransition(ctx.settings)

  const take = (score: (c: Candidate) => number): Candidate | undefined => {
    let best: Candidate | undefined
    let bestScore = -Infinity
    for (const c of candidates) {
      const overlaps = usedRanges.some((r) => r.clipId === c.clip.id && c.moment.start < r.out && c.moment.end > r.in)
      const s = score(c) - (usedClips.get(c.clip.id) ?? 0) * 0.35 - (overlaps ? 1 : 0) + (c.clip.mustInclude && !usedClips.has(c.clip.id) ? 0.6 : 0)
      if (s > bestScore) {
        best = c
        bestScore = s
      }
    }
    return best
  }

  const pick = (c: Candidate, len: number, transitionIn: Shot['transitionIn']): Shot => {
    const shot = shotFromMoment(c.clip, c.moment, len, { clipAudio: audioModeFor(c.clip, narrated), transitionIn })
    usedClips.set(c.clip.id, (usedClips.get(c.clip.id) ?? 0) + 1)
    usedRanges.push(shot)
    return shot
  }

  const scenes: Scene[] = []
  const lines = ctx.script?.lines ?? []

  if (lines.length) {
    lines.forEach((line, i) => {
      const target = lineSceneDuration(line, ctx.voiceMode)
      const parts = Math.max(1, Math.min(3, Math.round(target / 3.5)))
      const shots: Shot[] = []
      for (let p = 0; p < parts; p++) {
        const c = take((c) => c.moment.score + relevance(line, c.clip) * 1.5)
        if (!c) break
        shots.push(pick(c, target / parts, p === 0 && i > 0 ? transition : 'cut'))
      }
      let fitted = fitShots(shots, target, byId)
      // Clips too short to cover the line: keep adding shots until covered.
      let guard = 0
      while (fitted.deficit > 0.05 && guard++ < 6) {
        const c = take((c) => c.moment.score)
        if (!c) break
        fitted = fitShots([...fitted.shots, pick(c, fitted.deficit, 'cut')], target, byId)
      }
      scenes.push({ id: uid('sc_'), lineId: line.id, shots: fitted.shots })
    })
  } else {
    const total = targetTotalSec(ctx.settings)
    const len = vibeShotLength(ctx.settings)
    const picks: Candidate[] = []
    let acc = 0
    while (acc < total - 0.3) {
      const c = take((c) => c.moment.score)
      // Stop when only already-used footage is left rather than repeating it.
      if (!c || usedRanges.some((r) => r.clipId === c.clip.id && c.moment.start < r.out && c.moment.end > r.in)) break
      const shotLen = Math.min(len, total - acc)
      picks.push(c)
      const shot = pick(c, shotLen, scenes.length ? transition : 'cut')
      acc += shot.out - shot.in
      scenes.push({ id: uid('sc_'), shots: [shot] })
      if (picks.length > 60) break
    }
    // Present picks in the order they were filmed.
    const order = new Map(clips.map((c, i) => [c.id, i]))
    scenes.sort((a, b) => (order.get(a.shots[0].clipId)! - order.get(b.shots[0].clipId)!) || a.shots[0].in - b.shots[0].in)
    if (scenes[0]) scenes[0].shots[0].transitionIn = 'cut'
  }

  return {
    version: 0,
    createdAt: Date.now(),
    createdBy: 'fallback',
    aspect: ctx.settings.aspect,
    fps: 30,
    scenes: scenes.filter((s) => s.shots.length && sumShots(s.shots) > 0),
    title: { text: ctx.title, showUntilSec: 3 },
    music: ctx.musicTrackId ? { trackId: ctx.musicTrackId, gainDb: ctx.musicGainDb, duckUnderVoice: true } : undefined,
  }
}
