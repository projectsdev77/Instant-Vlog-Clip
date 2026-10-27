import { uid } from './ids'
import { MAX_SHOT, MIN_SHOT } from './timing'
import type { Clip, ClipAudioMode, Moment, Shot, Transition } from './types'

export const MIN_SPEED = 0.25
export const MAX_SPEED = 4
export const MAX_HOLD = 5
/** Shortest a freeze can be trimmed to when a scene has to get shorter. */
export const MIN_HOLD = 0.2

export const speedOf = (s: Shot) => (s.hold ? 1 : Math.max(MIN_SPEED, Math.min(MAX_SPEED, s.speed ?? 1)))
/** Seconds of the source clip the shot uses. */
export const srcSpan = (s: Shot) => (s.hold ? 0 : s.out - s.in)
/** Seconds the shot lasts in the vlog. */
export const shotLength = (s: Shot) => (s.hold ? s.hold : (s.out - s.in) / speedOf(s))
export const sumShots = (shots: Shot[]) => shots.reduce((a, s) => a + shotLength(s), 0)

/**
 * Speed curves as a warp of progress through the shot (0..1 → 0..1).
 * Each starts and ends at the shot's in/out points; the slope is the speed.
 */
export function rampWarp(ramp: Shot['ramp'], u: number): number {
  const x = Math.max(0, Math.min(1, u))
  switch (ramp) {
    case 'montage': {
      // fast → slow in the middle → fast
      const k = 0.55
      return x - (k / (2 * Math.PI)) * Math.sin(2 * Math.PI * x)
    }
    case 'hero': {
      // normal, then slows to a crawl for the end
      return Math.sin((x * Math.PI) / 2)
    }
    case 'bullet': {
      // fast start, slow-motion middle, fast end (stronger than montage)
      const k = 0.85
      return x - (k / (2 * Math.PI)) * Math.sin(2 * Math.PI * x)
    }
    default:
      return x
  }
}

/** Instantaneous speed at progress u (for preview playback rate). */
export function speedAt(s: Shot, u: number): number {
  if (s.hold) return 0
  const e = 1e-3
  const slope = (rampWarp(s.ramp, Math.min(1, u + e)) - rampWarp(s.ramp, Math.max(0, u - e))) / (Math.min(1, u + e) - Math.max(0, u - e))
  return speedOf(s) * slope
}

/**
 * Source time (inside the clip) shown `local` seconds into the shot. Past the
 * shot's end (used while a transition blends it out) it keeps playing at the
 * shot's base speed.
 */
export function sourceTime(s: Shot, local: number): number {
  if (s.hold) return s.in
  const len = shotLength(s)
  if (local <= len) return s.in + rampWarp(s.ramp, len > 0 ? local / len : 0) * (s.out - s.in)
  return s.out + (local - len) * speedOf(s)
}

export function isTalking(clip: Clip | undefined): boolean {
  return !!clip && (clip.analysis?.shotType === 'talking_head' || (clip.signals?.speechRatio ?? 0) > 0.5)
}

/** Builds a shot of `len` seconds centered on a moment, staying inside the clip. */
export function shotFromMoment(
  clip: Clip,
  moment: Moment,
  len: number,
  opts: { clipAudio?: ClipAudioMode; transitionIn?: Transition } = {},
): Shot {
  const dur = clip.durationSec
  const L = Math.min(len, dur)
  const center = (moment.start + moment.end) / 2
  let start = Math.max(moment.start, center - L / 2)
  if (start + L > dur) start = Math.max(0, dur - L)
  return {
    id: uid('s_'),
    clipId: clip.id,
    in: round(start),
    out: round(start + L),
    crop: { focusX: moment.focus.x, focusY: moment.focus.y, zoom: 1 },
    clipAudio: opts.clipAudio ?? 'duck',
    transitionIn: opts.transitionIn ?? 'cut',
  }
}

export const round = (v: number) => Math.round(v * 1000) / 1000

/** How long a single shot may be. Talking clips are allowed to run longer. */
export function maxShotFor(clip: Clip | undefined): number {
  return isTalking(clip) ? 30 : MAX_SHOT
}

/**
 * Makes `shots` add up to exactly `target` seconds by trimming, dropping or
 * extending shots inside their clips. Returns the remaining deficit (> 0 when
 * the shots' clips are too short to cover the target).
 */
export function fitShots(shots: Shot[], target: number, clips: Map<string, Clip>): { shots: Shot[]; deficit: number } {
  let out = shots.map((s) => ({ ...s }))

  // Shortens/lengthens a shot by `d` seconds of output time.
  const resize = (s: Shot, d: number) => {
    if (s.hold) s.hold = round(Math.max(0.1, s.hold + d))
    else s.out = round(s.out + d * speedOf(s))
  }

  // Too long: trim shots from the end, dropping extras that would go below the minimum.
  let excess = sumShots(out) - target
  while (excess > 1e-3 && out.length) {
    const last = out[out.length - 1]
    // A freeze may be shorter than a moving shot; trim it rather than drop it over a rounding difference.
    const room = last.hold ? last.hold - MIN_HOLD : shotLength(last) - MIN_SHOT
    if (room >= excess) {
      resize(last, -excess)
      excess = 0
    } else if (out.length > 1) {
      excess -= shotLength(last)
      out = out.slice(0, -1)
      // dropping may overshoot into a deficit, handled below
      if (excess < 0) break
    } else {
      resize(last, target - shotLength(last))
      excess = 0
    }
  }

  // Too short: extend shots forward then backward within their clips (holds just get longer).
  let deficit = target - sumShots(out)
  for (let i = out.length - 1; i >= 0 && deficit > 1e-3; i--) {
    const s = out[i]
    const clip = clips.get(s.clipId)
    if (!clip) continue
    if (s.hold) {
      const add = Math.min(deficit, MAX_HOLD - s.hold)
      if (add > 0) {
        s.hold = round(s.hold + add)
        deficit -= add
      }
      continue
    }
    const k = speedOf(s)
    const cap = Math.max(shotLength(s), maxShotFor(clip))
    const fwd = Math.min(deficit, (clip.durationSec - s.out) / k, cap - shotLength(s))
    if (fwd > 0) {
      s.out = round(s.out + fwd * k)
      deficit -= fwd
    }
    const back = Math.min(deficit, s.in / k, cap - shotLength(s))
    if (back > 0) {
      s.in = round(s.in - back * k)
      deficit -= back
    }
  }
  return { shots: out, deficit: Math.max(0, round(deficit)) }
}
