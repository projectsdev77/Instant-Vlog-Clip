import { uid } from './ids'
import { MAX_SHOT, MIN_SHOT } from './timing'
import type { Clip, ClipAudioMode, Moment, Shot, Transition } from './types'

export const shotLength = (s: Shot) => s.out - s.in
export const sumShots = (shots: Shot[]) => shots.reduce((a, s) => a + shotLength(s), 0)

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

  // Too long: trim shots from the end, dropping extras that would go below the minimum.
  let excess = sumShots(out) - target
  while (excess > 1e-3 && out.length) {
    const last = out[out.length - 1]
    const room = shotLength(last) - MIN_SHOT
    if (room >= excess) {
      last.out = round(last.out - excess)
      excess = 0
    } else if (out.length > 1) {
      excess -= shotLength(last)
      out = out.slice(0, -1)
      // dropping may overshoot into a deficit, handled below
      if (excess < 0) break
    } else {
      last.out = round(last.in + target)
      excess = 0
    }
  }

  // Too short: extend shots forward then backward within their clips.
  let deficit = target - sumShots(out)
  for (let i = out.length - 1; i >= 0 && deficit > 1e-3; i--) {
    const s = out[i]
    const clip = clips.get(s.clipId)
    if (!clip) continue
    const cap = Math.max(shotLength(s), maxShotFor(clip))
    const fwd = Math.min(deficit, clip.durationSec - s.out, cap - shotLength(s))
    if (fwd > 0) {
      s.out = round(s.out + fwd)
      deficit -= fwd
    }
    const back = Math.min(deficit, s.in, cap - shotLength(s))
    if (back > 0) {
      s.in = round(s.in - back)
      deficit -= back
    }
  }
  return { shots: out, deficit: Math.max(0, round(deficit)) }
}
