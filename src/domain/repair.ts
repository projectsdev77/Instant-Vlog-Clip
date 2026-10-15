import { z } from 'zod'
import { audioModeFor, planFallback } from './fallback'
import { uid } from './ids'
import { rankedMoments } from './moments'
import { usableClips, vibeShotLength, vibeTransition, videoTargetSec, type PlanContext } from './planContext'
import { fitShots, srcSpan, MAX_HOLD, MAX_SPEED, MIN_SPEED, round, shotFromMoment, shotLength, sumShots } from './shots'
import { lineSceneDuration, MAX_SHOT, MIN_SHOT } from './timing'
import { MOTIONS, RAMPS, TRANSITIONS, type EditPlan, type Scene, type Shot, type Transition } from './types'

const num = z.coerce.number().refine(Number.isFinite)
const transition = z.enum(TRANSITIONS).catch('cut')

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
  speed: num.optional().catch(undefined),
  ramp: z.enum(RAMPS).optional().catch(undefined),
  hold: num.optional().catch(undefined),
  volume: num.optional().catch(undefined),
  motion: z.enum(MOTIONS).optional().catch(undefined),
  fit: z.enum(['fill', 'blur']).optional().catch(undefined),
})
const RawScene = z.object({ id: z.string().optional(), lineId: z.string().nullish(), shots: z.array(z.unknown()) })
const RawPlan = z.object({ scenes: z.array(z.unknown()), note: z.string().optional() })

export type RepairResult = { plan: EditPlan; issues: string[]; usedFallback: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Turns whatever the planner returned into a plan the renderer can always play:
 * clamps in/out points, makes each narrated scene exactly cover its line,
 * fills missing lines, removes duplicate footage, and (unless `fill` is false)
 * adds footage-only scenes so every usable clip appears and the video reaches
 * its target length. `issues` lists what was
 * wrong, so a retry can show the model its mistakes.
 */
export function repairPlan(
  raw: unknown,
  ctx: PlanContext,
  createdBy: EditPlan['createdBy'] = 'ai',
  opts: { allowRepeats?: boolean; fill?: boolean } = {},
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
    !s.hold &&
    usedRanges.some((r) => !r.hold && r.clipId === s.clipId && Math.min(r.out, s.out) - Math.max(r.in, s.in) > 0.5 * Math.min(srcSpan(r), srcSpan(s)))

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
    if (r.hold && r.hold > 0) b = a // freeze frame: one frame, at `in`
    else if (b - a < Math.min(MIN_SHOT * clamp(r.speed ?? 1, MIN_SPEED, MAX_SPEED), clip.durationSec)) {
      // widen around the middle (to MIN_SHOT seconds of video at the shot's speed)
      const need = Math.min(MIN_SHOT * clamp(r.speed ?? 1, MIN_SPEED, MAX_SPEED), clip.durationSec)
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
    if (r.hold && r.hold > 0) shot.hold = round(clamp(r.hold, 0.1, MAX_HOLD))
    else if (r.speed && Math.abs(r.speed - 1) > 1e-3) shot.speed = round(clamp(r.speed, MIN_SPEED, MAX_SPEED))
    if (r.ramp && r.ramp !== 'none' && !shot.hold) {
      shot.ramp = r.ramp
      shot.clipAudio = 'mute'
    }
    if (r.volume !== undefined && Math.abs(r.volume - 1) > 1e-3) shot.volume = clamp(r.volume, 0, 2)
    if (r.motion && r.motion !== 'none') shot.motion = r.motion
    if (r.fit) shot.fit = r.fit
    if (overlapsUsed(shot)) {
      issues.push(`scenes[${si}].shots[${i}] repeats footage already used`)
      return null
    }
    usedRanges.push(shot)
    return shot
  }

  const freshShot = (len: number, o: { underVoice?: boolean; freshOnly?: boolean } = {}): Shot | null => {
    const voiced = o.underVoice ?? narrated
    const uses = (id: string) => usedRanges.filter((r) => r.clipId === id).length
    const all = usableClips(ctx.clips).flatMap((clip) => rankedMoments(clip).map((m) => ({ clip, m, rank: m.score - uses(clip.id) * 0.3 })))
    all.sort((x, y) => y.rank - x.rank)
    for (const { clip, m } of all) {
      const s = shotFromMoment(clip, m, len, { clipAudio: audioModeFor(clip, voiced) })
      if (!overlapsUsed(s)) {
        usedRanges.push(s)
        return s
      }
    }
    if (o.freshOnly) return null
    const best = all[0]
    return best ? shotFromMoment(best.clip, best.m, len, { clipAudio: audioModeFor(best.clip, voiced) }) : null
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
    // Exactly one scene per line, in script order. Footage-only scenes (no
    // lineId) stay after the line they followed.
    const byLine = new Map<string, Shot[]>()
    const sceneIds = new Map<string, string>()
    const after = new Map<string, Scene[]>()
    let prevLine = lines[0].id
    for (const s of rawScenes) {
      if (!s.lineId) {
        if (s.shots.length) after.set(prevLine, [...(after.get(prevLine) ?? []), { id: s.id ?? uid('sc_'), shots: s.shots.map((x) => ({ ...x, clipAudio: x.clipAudio === 'mute' ? audioModeFor(clips.get(x.clipId), false) : x.clipAudio })) }])
        continue
      }
      if (!lines.some((l) => l.id === s.lineId)) {
        issues.push(`scene has unknown lineId "${s.lineId}"`)
        continue
      }
      byLine.set(s.lineId, [...(byLine.get(s.lineId) ?? []), ...s.shots])
      if (s.id && !sceneIds.has(s.lineId)) sceneIds.set(s.lineId, s.id)
      prevLine = s.lineId
    }
    scenes = lines.flatMap((line) => {
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
      return [{ id: sceneIds.get(line.id) ?? uid('sc_'), lineId: line.id, shots: fitted.shots }, ...(after.get(line.id) ?? [])]
    })
  } else {
    scenes = rawScenes.filter((s) => s.shots.length).map((s) => ({ id: s.id ?? uid('sc_'), shots: s.shots }))
  }

  scenes = scenes.filter((s) => s.shots.length)
  if (opts.fill !== false && scenes.length) scenes = fillScenes(scenes, ctx, { freshShot, usedRanges })

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
  const { plan: fixed } = repairPlan(raw, { ...ctx, settings: { ...ctx.settings, aspect: plan.aspect } }, plan.createdBy, { allowRepeats: true, fill: false })
  return { ...fixed, title: plan.title, music: plan.music, look: plan.look, fades: plan.fades, templateId: plan.templateId, version: plan.version, createdAt: plan.createdAt }
}

/**
 * Grows footage-only shots (up to MAX_SHOT) into parts of their clip that no
 * other shot uses. Returns the seconds added.
 */
function lengthenFootage(scenes: Scene[], need: number, clips: Map<string, PlanContext['clips'][number]>): number {
  const all = scenes.flatMap((s) => s.shots)
  let added = 0
  for (const s of scenes) {
    if (s.lineId) continue
    for (const shot of s.shots) {
      if (added >= need - 1e-3) return added
      const clip = clips.get(shot.clipId)
      if (!clip) continue
      const others = all.filter((o) => o !== shot && o.clipId === shot.clipId)
      const limitOut = Math.min(clip.durationSec, ...others.filter((o) => o.in >= shot.out - 1e-3).map((o) => o.in))
      const limitIn = Math.max(0, ...others.filter((o) => o.out <= shot.in + 1e-3).map((o) => o.out))
      const cap = MAX_SHOT - shotLength(shot)
      const fwd = Math.max(0, Math.min(need - added, limitOut - shot.out, cap))
      shot.out = round(shot.out + fwd)
      added += fwd
      const back = Math.max(0, Math.min(need - added, shot.in - limitIn, MAX_SHOT - shotLength(shot)))
      shot.in = round(shot.in - back)
      added += back
    }
  }
  return added
}

/** Clips in the order they were filmed. */
function filmingOrder(clips: PlanContext['clips']): Map<string, number> {
  const sorted = [...clips].sort((a, b) => (a.recordedAt ?? '').localeCompare(b.recordedAt ?? '') || a.addedAt - b.addedAt)
  return new Map(sorted.map((c, i) => [c.id, i]))
}

/**
 * Adds footage-only scenes so that every usable clip appears at least once and
 * the video reaches its target length, then trims footage-only scenes if the
 * plan runs long. Narrated scenes are never changed. New footage goes next to
 * footage filmed around the same time; the first narrated line stays first.
 */
function fillScenes(
  input: Scene[],
  ctx: PlanContext,
  h: { freshShot: (len: number, o?: { underVoice?: boolean; freshOnly?: boolean }) => Shot | null; usedRanges: Shot[] },
): Scene[] {
  const scenes = input.map((s) => ({ ...s, shots: [...s.shots] }))
  const order = filmingOrder(ctx.clips)
  const clipsById = new Map(ctx.clips.map((c) => [c.id, c]))
  const narratedFirst = !!scenes[0]?.lineId
  const len = vibeShotLength(ctx.settings)
  const transition = vibeTransition(ctx.settings)
  const total = () => scenes.reduce((a, s) => a + sumShots(s.shots), 0)

  const insert = (shot: Shot) => {
    const o = order.get(shot.clipId) ?? 0
    let pos = 0
    scenes.forEach((s, i) => {
      if ((order.get(s.shots[0].clipId) ?? 0) <= o) pos = i + 1
    })
    if (narratedFirst) pos = Math.max(pos, 1)
    scenes.splice(pos, 0, { id: uid('sc_'), shots: [{ ...shot, transitionIn: transition }] })
  }

  // 1. Every usable clip appears at least once.
  const used = new Set(scenes.flatMap((s) => s.shots.map((x) => x.clipId)))
  for (const clip of usableClips(ctx.clips).sort((a, b) => order.get(a.id)! - order.get(b.id)!)) {
    if (used.has(clip.id)) continue
    const m = rankedMoments(clip)[0]
    if (!m) continue
    const shot = shotFromMoment(clip, m, Math.min(len, clip.durationSec), { clipAudio: audioModeFor(clip, false) })
    h.usedRanges.push(shot)
    insert(shot)
    used.add(clip.id)
  }

  // 2. Reach the target length with more unused footage.
  const target = videoTargetSec(ctx)
  let guard = 0
  while (total() < target - 0.3 && guard++ < 80) {
    const need = target - total()
    if (need < MIN_SHOT) {
      const last = [...scenes].reverse().find((s) => !s.lineId)
      if (last) last.shots = fitShots(last.shots, sumShots(last.shots) + need, clipsById).shots
      break
    }
    const shot = h.freshShot(Math.min(len, need), { underVoice: false, freshOnly: true })
    if (shot) {
      insert(shot)
      continue
    }
    // No new moments left: lengthen footage-only shots into unused parts of their clips.
    if (!lengthenFootage(scenes, need, clipsById)) break // out of footage: shorter beats repeating shots
  }

  // 3. Too long: shorten footage-only shots, then drop ones whose clip appears elsewhere.
  let excess = total() - Math.max(target, 0)
  if (excess > 0.5) {
    for (const s of scenes) {
      if (s.lineId) continue
      for (const shot of s.shots) {
        const cut = Math.min(excess, shotLength(shot) - Math.max(MIN_SHOT, 1.2))
        if (cut > 0) {
          shot.out = round(shot.out - cut)
          excess -= cut
        }
      }
    }
    for (let i = scenes.length - 1; i >= 0 && excess > 0.5; i--) {
      const s = scenes[i]
      if (s.lineId) continue
      const elsewhere = s.shots.every((x) => scenes.some((o) => o !== s && o.shots.some((y) => y.clipId === x.clipId)))
      if (!elsewhere) continue
      excess -= sumShots(s.shots)
      scenes.splice(i, 1)
    }
  }
  return scenes
}
