import { z } from 'zod'
import { audioModeFor, planFallback } from './fallback'
import { uid } from './ids'
import { rankedMoments } from './moments'
import type { PlanContext } from './planContext'
import { fitShots, round, shotFromMoment, shotLength } from './shots'
import { lineSceneDuration, MIN_SHOT } from './timing'
import type { EditPlan, Scene, Shot, Transition } from './types'

const num = z.coerce.number().refine(Number.isFinite)
const transition = z.enum(['cut', 'crossfade', 'dip', 'whip']).catch('cut')

/** Lenient shape for plans coming from the AI (or old saved data). */
const RawShot = z.object({
  id: z.string().optional(),
  clipId: z.string(),
  in: num,
  out: num,
  focusX: num.optional(),
  focusY: num.optional(),
  zoom: num.optional(),
  crop: z.object({ focusX: num, focusY: num, zoom: num.optional() }).partial().optional(),
  clipAudio: z.enum(['mute', 'duck', 'full']).optional().catch(undefined),
  transitionIn: transition.optional(),
})
const RawScene = z.object({ id: z.string().optional(), lineId: z.string().nullish(), shots: z.array(z.unknown()) })
const RawPlan = z.object({ scenes: z.array(z.unknown()), note: z.string().optional() })

export type RepairResult = { plan: EditPlan; issues: string[]; usedFallback: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Turns whatever the planner returned into a plan the renderer can always play:
 * clamps in/out points, makes each narrated scene exactly cover its line,
 * fills missing lines, removes duplicate footage. `issues` lists what was
 * wrong, so a retry can show the model its mistakes.
 */
export function repairPlan(
  raw: unknown,
  ctx: PlanContext,
  createdBy: EditPlan['createdBy'] = 'ai',
  opts: { allowRepeats?: boolean } = {},
): RepairResult {
  const issues: string[] = []
  const clips = new Map(ctx.clips.map((c) => [c.id, c]))
  const lines = ctx.script?.lines ?? []
  const narrated = ctx.voiceMode !== 'none'
  const parsed = RawPlan.safeParse(raw)
  if (!parsed.success) {
    return { plan: planFallback(ctx), issues: ['Plan is not an object with a scenes array'], usedFallback: true }
  }

  const usedRanges: Shot[] = []
  const overlapsUsed = (s: Shot) =>
    !opts.allowRepeats &&
    usedRanges.some((r) => r.clipId === s.clipId && Math.min(r.out, s.out) - Math.max(r.in, s.in) > 0.5 * Math.min(shotLength(r), shotLength(s)))

  const cleanShot = (rawShot: unknown, si: number, i: number): Shot | null => {
    const p = RawShot.safeParse(rawShot)
    if (!p.success) {
      issues.push(`scenes[${si}].shots[${i}] is malformed`)
      return null
    }
    const r = p.data
    const clip = clips.get(r.clipId)
    if (!clip) {
      issues.push(`scenes[${si}].shots[${i}] uses unknown clipId "${r.clipId}"`)
      return null
    }
    let a = clamp(Math.min(r.in, r.out), 0, clip.durationSec)
    let b = clamp(Math.max(r.in, r.out), 0, clip.durationSec)
    if (a !== r.in || b !== r.out) issues.push(`scenes[${si}].shots[${i}] in/out outside clip ${clip.id} (0–${clip.durationSec.toFixed(2)}s)`)
    if (b - a < Math.min(MIN_SHOT, clip.durationSec)) {
      // widen around the middle
      const need = Math.min(MIN_SHOT, clip.durationSec)
      const mid = (a + b) / 2
      a = clamp(mid - need / 2, 0, clip.durationSec - need)
      b = a + need
    }
    const shot: Shot = {
      id: r.id ?? uid('s_'),
      clipId: clip.id,
      in: round(a),
      out: round(b),
      crop: {
        focusX: clamp(r.crop?.focusX ?? r.focusX ?? 0.5, 0, 1),
        focusY: clamp(r.crop?.focusY ?? r.focusY ?? 0.5, 0, 1),
        zoom: clamp(r.crop?.zoom ?? r.zoom ?? 1, 1, 2),
      },
      clipAudio: r.clipAudio ?? audioModeFor(clip, narrated),
      transitionIn: (r.transitionIn ?? 'cut') as Transition,
    }
    if (overlapsUsed(shot)) {
      issues.push(`scenes[${si}].shots[${i}] repeats footage already used`)
      return null
    }
    usedRanges.push(shot)
    return shot
  }

  const freshShot = (len: number): Shot | null => {
    const all = ctx.clips.flatMap((clip) => rankedMoments(clip).map((m) => ({ clip, m })))
    all.sort((x, y) => y.m.score - x.m.score)
    for (const { clip, m } of all) {
      const s = shotFromMoment(clip, m, len, { clipAudio: audioModeFor(clip, narrated) })
      if (!overlapsUsed(s)) {
        usedRanges.push(s)
        return s
      }
    }
    const best = all[0]
    return best ? shotFromMoment(best.clip, best.m, len, { clipAudio: audioModeFor(best.clip, narrated) }) : null
  }

  const rawScenes = parsed.data.scenes
    .map((s, si) => {
      const p = RawScene.safeParse(s)
      if (!p.success) {
        issues.push(`scenes[${si}] is malformed`)
        return null
      }
      return { id: p.data.id, lineId: p.data.lineId ?? undefined, shots: p.data.shots.map((x, i) => cleanShot(x, si, i)).filter((x): x is Shot => !!x) }
    })
    .filter((s): s is { id: string | undefined; lineId: string | undefined; shots: Shot[] } => !!s)

  let scenes: Scene[]
  if (lines.length) {
    // Exactly one scene per line, in script order.
    const byLine = new Map<string, Shot[]>()
    const sceneIds = new Map<string, string>()
    for (const s of rawScenes) {
      if (!s.lineId || !lines.some((l) => l.id === s.lineId)) {
        issues.push(`scene has unknown lineId "${s.lineId ?? ''}"`)
        continue
      }
      byLine.set(s.lineId, [...(byLine.get(s.lineId) ?? []), ...s.shots])
      if (s.id && !sceneIds.has(s.lineId)) sceneIds.set(s.lineId, s.id)
    }
    scenes = lines.map((line) => {
      const target = lineSceneDuration(line, ctx.voiceMode)
      let shots = byLine.get(line.id) ?? []
      if (!shots.length) {
        issues.push(`line "${line.id}" has no scene`)
        const s = freshShot(target)
        shots = s ? [s] : []
      }
      let fitted = fitShots(shots, target, clips)
      let guard = 0
      while (fitted.deficit > 0.05 && guard++ < 6) {
        const s = freshShot(fitted.deficit)
        if (!s) break
        fitted = fitShots([...fitted.shots, s], target, clips)
      }
      return { id: sceneIds.get(line.id) ?? uid('sc_'), lineId: line.id, shots: fitted.shots }
    })
  } else {
    scenes = rawScenes.filter((s) => s.shots.length).map((s) => ({ id: s.id ?? uid('sc_'), shots: s.shots }))
  }

  scenes = scenes.filter((s) => s.shots.length)
  if (!scenes.length) {
    return { plan: planFallback(ctx), issues: [...issues, 'Plan has no usable shots'], usedFallback: true }
  }
  scenes[0].shots[0].transitionIn = 'cut'

  return {
    plan: {
      version: 0,
      createdAt: Date.now(),
      createdBy,
      note: parsed.data.note,
      aspect: ctx.settings.aspect,
      fps: 30,
      scenes,
      title: { text: ctx.title, showUntilSec: 3 },
      music: ctx.musicTrackId ? { trackId: ctx.musicTrackId, gainDb: ctx.musicGainDb, duckUnderVoice: true } : undefined,
    },
    issues,
    usedFallback: false,
  }
}

/** Re-fits an existing plan after the user edits (trim, line text change, etc.). */
export function refitPlan(plan: EditPlan, ctx: PlanContext): EditPlan {
  const raw = {
    note: plan.note,
    scenes: plan.scenes.map((s) => ({ id: s.id, lineId: s.lineId, shots: s.shots })),
  }
  const { plan: fixed } = repairPlan(raw, { ...ctx, settings: { ...ctx.settings, aspect: plan.aspect } }, plan.createdBy, { allowRepeats: true })
  return { ...fixed, title: plan.title, music: plan.music, version: plan.version, createdAt: plan.createdAt }
}
