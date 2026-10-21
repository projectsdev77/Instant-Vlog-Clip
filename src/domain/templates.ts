import type { PlanTemplate } from '@shared/contracts.ts'
import { round, shotLength, sumShots } from './shots'
import { DEFAULT_LOOK, type EditPlan, type Look, type Motion, type Ramp, type Shot, type StyleId, type TemplateId, type Transition, type Vibe } from './types'

/**
 * Edit templates: a whole "way of cutting" in one tap, like CapCut templates,
 * except the AI fills them with the user's own clips and script. A template
 * sets the color look, caption style, pacing, and which transitions, camera
 * moves and speed effects the AI editor may use.
 */
export type EditTemplate = {
  id: TemplateId
  name: string
  description: string
  vibe: Vibe
  styleId: StyleId
  look: Look
  fades: { in: boolean; out: boolean }
  /** footage-only shot length, seconds */
  shotSec: number
  /** transitions used between scenes; first ones are preferred */
  transitions: Transition[]
  /** share of scene changes that get a transition (the rest are cuts) */
  transitionShare: number
  /** transitions allowed between shots inside a scene */
  innerTransitions: Transition[]
  motions: Motion[]
  /** share of shots that get a camera move */
  motionShare: number
  /** speeds the editor may use on footage-only shots, besides 1 */
  speeds: number[]
  ramps: Ramp[]
  /** share of footage-only shots that get a speed effect */
  speedShare: number
  /** land footage-only cuts on the music's beat */
  beatSync: boolean
  /** plain-language guide for the AI editor */
  guide: string
}

const look = (l: Partial<Look>): Look => ({ ...DEFAULT_LOOK, ...l })

export const TEMPLATES: EditTemplate[] = [
  {
    id: 'daily',
    name: 'Day in my life',
    description: 'Warm, easy, gentle moves',
    vibe: 'auto',
    styleId: 'ember',
    look: look({ filter: 'warm', intensity: 0.55 }),
    fades: { in: true, out: true },
    shotSec: 2.2,
    transitions: ['crossfade', 'zoom', 'slide'],
    transitionShare: 0.6,
    innerTransitions: ['cut'],
    motions: ['zoomIn', 'zoomOut', 'panLeft', 'panRight'],
    motionShare: 0.55,
    speeds: [1.5],
    ramps: [],
    speedShare: 0.15,
    beatSync: true,
    guide: 'Relaxed day-in-my-life vlog. Smooth crossfades between moments, a zoom or slide when the scene changes place, slow gentle camera moves, a few sped-up shots for walking or travelling.',
  },
  {
    id: 'trend',
    name: 'TikTok fast cuts',
    description: 'Punchy, on the beat',
    vibe: 'upbeat',
    styleId: 'bold',
    look: look({ filter: 'vivid', intensity: 0.8, contrast: 0.1 }),
    fades: { in: false, out: true },
    shotSec: 1.2,
    transitions: ['whip', 'flash', 'zoom', 'slide'],
    transitionShare: 0.85,
    innerTransitions: ['cut', 'whip', 'flash'],
    motions: ['punch', 'shake', 'zoomIn'],
    motionShare: 0.75,
    speeds: [1.5, 2],
    ramps: ['montage', 'bullet'],
    speedShare: 0.4,
    beatSync: true,
    guide: 'Fast TikTok-style edit. Short shots cut on the beat, whip pans and flashes between scenes, punch-in zooms on reactions and key moments, a shake on big hits, speed ramps (fast-slow-fast) on action shots, sped-up filler.',
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Film look, slow-mo, soft fades',
    vibe: 'cinematic',
    styleId: 'minimal',
    look: look({ filter: 'teal', intensity: 0.75, vignette: 0.4, grain: 0.25, contrast: 0.08, letterbox: true }),
    fades: { in: true, out: true },
    shotSec: 3.4,
    transitions: ['crossfade', 'dip', 'blur'],
    transitionShare: 0.7,
    innerTransitions: ['cut', 'crossfade'],
    motions: ['zoomIn', 'panLeft', 'panRight', 'zoomOut'],
    motionShare: 0.85,
    speeds: [0.5],
    ramps: ['hero'],
    speedShare: 0.35,
    beatSync: false,
    guide: 'Cinematic mini-film. Long, slow shots with slow push-ins and pans, slow motion (0.5) on beautiful moments like water, sunsets, hair or hands, soft crossfades, a dip to black between chapters, a hero ramp into slow motion on the best shot.',
  },
  {
    id: 'travel',
    name: 'Travel diary',
    description: 'Bright, whips and pans',
    vibe: 'upbeat',
    styleId: 'classic',
    look: look({ filter: 'vivid', intensity: 0.6, warmth: 0.1 }),
    fades: { in: false, out: true },
    shotSec: 1.9,
    transitions: ['whip', 'slide', 'zoom', 'crossfade'],
    transitionShare: 0.75,
    innerTransitions: ['cut', 'whip'],
    motions: ['panLeft', 'panRight', 'zoomIn', 'punch'],
    motionShare: 0.6,
    speeds: [1.5, 2],
    ramps: ['montage'],
    speedShare: 0.3,
    beatSync: true,
    guide: 'Energetic travel diary. Whip pans and slides when the location changes, pans across landscapes and streets, sped-up shots for walking, driving or flights, a punch-in on food and landmarks.',
  },
  {
    id: 'aesthetic',
    name: 'Aesthetic',
    description: 'Soft film, dreamy pace',
    vibe: 'aesthetic',
    styleId: 'soft',
    look: look({ filter: 'fade', intensity: 0.8, grain: 0.3, saturation: -0.1 }),
    fades: { in: true, out: true },
    shotSec: 2.8,
    transitions: ['crossfade', 'blur'],
    transitionShare: 0.8,
    innerTransitions: ['crossfade'],
    motions: ['zoomIn', 'zoomOut'],
    motionShare: 0.7,
    speeds: [0.5],
    ramps: [],
    speedShare: 0.3,
    beatSync: false,
    guide: 'Soft, dreamy aesthetic edit. Slow dissolves and blur transitions, very slow zooms, slow motion on details (coffee, light, flowers, hands), nothing jarring.',
  },
  {
    id: 'clean',
    name: 'Clean',
    description: 'Straight cuts, no effects',
    vibe: 'auto',
    styleId: 'minimal',
    look: look({}),
    fades: { in: false, out: true },
    shotSec: 2.4,
    transitions: ['cut'],
    transitionShare: 0,
    innerTransitions: ['cut'],
    motions: ['none'],
    motionShare: 0,
    speeds: [],
    ramps: [],
    speedShare: 0,
    beatSync: false,
    guide: 'Clean, simple edit: straight cuts, no camera moves or speed effects.',
  },
]

export const templateById = (id: TemplateId | undefined) => TEMPLATES.find((t) => t.id === id)

/** "Auto" picks a template that suits the vibe. */
export function resolveTemplate(choice: TemplateId | 'auto' | undefined, vibe: Vibe): EditTemplate {
  const t = choice && choice !== 'auto' ? templateById(choice) : undefined
  if (t) return t
  const byVibe: Partial<Record<Vibe, TemplateId>> = { upbeat: 'trend', funny: 'trend', cinematic: 'cinematic', aesthetic: 'aesthetic', chill: 'daily' }
  return templateById(byVibe[vibe] ?? 'daily')!
}

/** What the AI editor is told about the template. */
export function planTemplate(t: EditTemplate): PlanTemplate {
  return {
    name: t.name,
    guide: t.guide,
    transitions: [...new Set<Transition>(['cut', ...t.transitions, ...t.innerTransitions])],
    motions: [...new Set<Motion>(['none', ...t.motions])],
    speeds: t.speeds,
    ramps: t.ramps,
    shotSec: t.shotSec,
  }
}

/** Stable pseudo-random 0..1 from a string, so a template applies the same way twice. */
function hash01(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}
const pick = <T,>(list: T[], key: string): T => list[Math.floor(hash01(key) * list.length) % list.length]

type StylizeOpts = {
  /** keep effects the AI chose when the template allows them (otherwise re-pick everything) */
  keepChoices?: boolean
  /** add effects until the template's share is reached (off when the user asked the AI for something specific) */
  topUp?: boolean
  /** keep this look and fades instead of the template's (the user changed them) */
  look?: EditPlan['look']
  fades?: EditPlan['fades']
  /** music tempo for beat-synced cuts */
  bpm?: number
  clipDurations?: Map<string, number>
}

/**
 * Applies a template to a plan: look, fades, transitions, camera moves, speed
 * effects and beat-synced cuts. Narrated scenes keep their exact lengths;
 * footage-only shots keep theirs too unless beat sync moves a cut.
 */
export function stylize(plan: EditPlan, t: EditTemplate, opts: StylizeOpts = {}): EditPlan {
  const out: EditPlan = {
    ...plan,
    templateId: t.id,
    look: opts.look ? { ...opts.look } : { ...t.look },
    fades: opts.fades ? { ...opts.fades } : { ...t.fades },
    scenes: plan.scenes.map((s) => ({ ...s, shots: s.shots.map((x) => ({ ...x })) })),
  }
  const allowedTr = new Set<Transition>(['cut', ...t.transitions, ...t.innerTransitions])
  const allowedMotion = new Set<Motion>(['none', ...t.motions])
  const keep = !!opts.keepChoices
  const topUp = opts.topUp !== false
  const shots: { shot: Shot; scene: number; first: boolean; footage: boolean }[] = []
  out.scenes.forEach((s, si) => s.shots.forEach((shot, i) => shots.push({ shot, scene: si, first: i === 0, footage: !s.lineId })))

  // Transitions
  shots.forEach(({ shot, first }, i) => {
    if (i === 0) {
      shot.transitionIn = 'cut'
      return
    }
    if (keep && allowedTr.has(shot.transitionIn) && (shot.transitionIn !== 'cut' || !topUp)) return
    if (first) shot.transitionIn = hash01(`${shot.id}:tr`) < t.transitionShare ? pick(t.transitions, `${shot.id}:trp`) : 'cut'
    else shot.transitionIn = keep && allowedTr.has(shot.transitionIn) ? shot.transitionIn : hash01(`${shot.id}:itr`) < 0.4 ? pick(t.innerTransitions, `${shot.id}:itrp`) : 'cut'
  })

  // Camera moves: keep allowed AI choices, then top up to the template's share.
  for (const { shot } of shots) if (!keep || !allowedMotion.has(shot.motion ?? 'none')) shot.motion = 'none'
  const wantMoves = topUp ? Math.round(shots.length * t.motionShare) : 0
  let moves = shots.filter((x) => (x.shot.motion ?? 'none') !== 'none').length
  for (const { shot } of [...shots].sort((a, b) => hash01(`${a.shot.id}:m`) - hash01(`${b.shot.id}:m`))) {
    if (moves >= wantMoves || !t.motions.length || t.motions[0] === 'none') break
    if ((shot.motion ?? 'none') !== 'none' || shot.hold) continue
    shot.motion = pick(t.motions, `${shot.id}:mp`)
    moves++
  }

  // Speed effects on footage-only shots (narration keeps its natural pace).
  const footage = shots.filter((x) => x.footage && !x.shot.hold)
  for (const { shot } of shots.filter((x) => !x.shot.hold)) {
    const allowed = (shot.speed ?? 1) === 1 || t.speeds.includes(shot.speed!)
    if (!keep || !allowed) setSpeed(shot, 1, opts.clipDurations)
    if (!keep || (shot.ramp && !t.ramps.includes(shot.ramp))) shot.ramp = 'none'
  }
  const wantSpeed = topUp ? Math.round(footage.length * t.speedShare) : 0
  let sped = footage.filter((x) => (x.shot.speed ?? 1) !== 1 || (x.shot.ramp ?? 'none') !== 'none').length
  for (const { shot } of [...footage].sort((a, b) => hash01(`${a.shot.id}:s`) - hash01(`${b.shot.id}:s`))) {
    if (sped >= wantSpeed) break
    if ((shot.speed ?? 1) !== 1 || (shot.ramp ?? 'none') !== 'none') continue
    const useRamp = t.ramps.length && (!t.speeds.length || hash01(`${shot.id}:sr`) < 0.5) && shotLength(shot) >= 1.4
    if (useRamp) shot.ramp = pick(t.ramps, `${shot.id}:rp`)
    else if (t.speeds.length) setSpeed(shot, pick(t.speeds, `${shot.id}:sp`), opts.clipDurations)
    else continue
    sped++
  }
  for (const { shot } of shots) if (shot.ramp && shot.ramp !== 'none') shot.clipAudio = 'mute'

  if (t.beatSync && opts.bpm) beatSync(out, opts.bpm, opts.clipDurations)
  return out
}

/** Changes a shot's speed while keeping how long it lasts (uses more or less footage). */
export function setSpeed(shot: Shot, speed: number, clipDurations?: Map<string, number>) {
  const len = shotLength(shot)
  const dur = clipDurations?.get(shot.clipId) ?? Infinity
  shot.speed = speed
  let span = len * speed
  if (shot.in + span > dur) {
    const start = Math.max(0, dur - span)
    span = Math.min(span, dur - start)
    shot.in = round(start)
  }
  shot.out = round(shot.in + span)
  if (speed === 1) delete shot.speed
}

/**
 * Moves the end of each footage-only scene onto the nearest beat (every
 * other beat for very fast music), so cuts land on the music. Narrated scenes are left
 * alone, so the beat grid is followed from wherever they end.
 */
function beatSync(plan: EditPlan, bpm: number, clipDurations?: Map<string, number>) {
  const beat = 60 / bpm
  // cut on every beat, or every other beat for very fast songs
  const grid = beat < 0.4 ? beat * 2 : beat
  let t = 0
  for (const scene of plan.scenes) {
    const len = sumShots(scene.shots)
    if (scene.lineId || scene.shots.length !== 1) {
      t += len
      continue
    }
    const shot = scene.shots[0]
    const end = t + len
    const dur = clipDurations?.get(shot.clipId) ?? Infinity
    const k = shot.speed ?? 1
    // nearest beat first, then the other side if the clip can't stretch that far
    const beats = [Math.round(end / grid), Math.floor(end / grid), Math.ceil(end / grid)].map((b) => b * grid)
    for (const target of [...new Set(beats)].sort((a, b) => Math.abs(a - end) - Math.abs(b - end))) {
      const newLen = len + (target - end)
      if (newLen < 0.6) continue
      if (shot.hold) {
        shot.hold = round(newLen)
        break
      }
      const span = newLen * k
      if (shot.in + span <= dur) {
        shot.out = round(shot.in + span)
        break
      }
      if (shot.out - span >= 0) {
        shot.in = round(shot.out - span)
        break
      }
    }
    t += sumShots(scene.shots)
  }
}
