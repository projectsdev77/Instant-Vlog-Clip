import { describe, expect, it } from 'vitest'
import { makeClip, makeCtx, makeScript } from '@/test/fixtures'
import { repairPlan } from './repair'
import { shotLength, sourceTime, sumShots } from './shots'
import { stylize, templateById, TEMPLATES } from './templates'
import { DEFAULT_SETTINGS } from './types'

const clips = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => makeClip(id, 12, { addedAt: i }))
const script = makeScript(['So here is my day.', 'Best part was the lake.'])
const ctx = makeCtx(clips, script, { settings: { ...DEFAULT_SETTINGS, targetSec: 30 } })
const base = repairPlan({ scenes: script.lines.map((l, i) => ({ lineId: l.id, shots: [{ clipId: clips[i].id, in: 0, out: 2.35 }] })) }, ctx).plan
const lengths = (p: typeof base) => p.scenes.map((s) => +sumShots(s.shots).toFixed(3))
const durations = new Map(clips.map((c) => [c.id, c.durationSec]))

describe('templates', () => {
  it('TikTok template adds transitions, moves and speed effects', () => {
    const p = stylize(base, templateById('trend')!, { clipDurations: durations })
    const shots = p.scenes.flatMap((s) => s.shots)
    expect(shots[0].transitionIn).toBe('cut')
    expect(shots.filter((x) => x.transitionIn !== 'cut').length).toBeGreaterThan(shots.length / 2)
    expect(shots.filter((x) => x.motion && x.motion !== 'none').length).toBeGreaterThan(shots.length / 2)
    expect(shots.some((x) => (x.speed ?? 1) !== 1 || (x.ramp ?? 'none') !== 'none')).toBe(true)
    expect(p.look?.filter).toBe('vivid')
  })

  it('keeps every scene the same length without beat sync', () => {
    for (const t of TEMPLATES) {
      const p = stylize(base, t, { clipDurations: durations })
      p.scenes.forEach((s, i) => expect(sumShots(s.shots)).toBeCloseTo(sumShots(base.scenes[i].shots), 2))
    }
  })

  it('beat sync moves footage cuts onto the beat but never narrated scenes', () => {
    const p = stylize(base, templateById('trend')!, { bpm: 120, clipDurations: durations })
    let t = 0
    p.scenes.forEach((s, i) => {
      const len = sumShots(s.shots)
      if (s.lineId) expect(len).toBeCloseTo(sumShots(base.scenes[i].shots), 3)
      else {
        const end = t + len
        const grid = 0.5
        expect(Math.abs(end / grid - Math.round(end / grid))).toBeLessThan(0.01)
      }
      t += len
    })
  })

  it('clean template removes effects', () => {
    const fancy = stylize(base, templateById('trend')!, { clipDurations: durations })
    const p = stylize(fancy, templateById('clean')!, { clipDurations: durations })
    const shots = p.scenes.flatMap((s) => s.shots)
    expect(shots.every((x) => x.transitionIn === 'cut' && (x.motion ?? 'none') === 'none' && (x.speed ?? 1) === 1)).toBe(true)
    expect(lengths(p)).toEqual(lengths(fancy))
  })
})

describe('speed and freeze', () => {
  it('slow motion lasts longer for the same footage', () => {
    const shot = { ...base.scenes[0].shots[0], in: 1, out: 3, speed: 0.5 }
    expect(shotLength(shot)).toBeCloseTo(4)
    expect(sourceTime(shot, 2)).toBeCloseTo(2)
  })
  it('ramps start and end on the in/out points', () => {
    const shot = { ...base.scenes[0].shots[0], in: 1, out: 3, ramp: 'montage' as const }
    expect(sourceTime(shot, 0)).toBeCloseTo(1)
    expect(sourceTime(shot, shotLength(shot))).toBeCloseTo(3)
  })
  it('freeze frames show one frame', () => {
    const shot = { ...base.scenes[0].shots[0], in: 1.5, out: 1.5, hold: 1.2 }
    expect(shotLength(shot)).toBeCloseTo(1.2)
    expect(sourceTime(shot, 0.9)).toBe(1.5)
  })
  it('repair keeps a narrated scene exactly covering its line at 2x speed', () => {
    const raw = { scenes: [{ lineId: 'l0', shots: [{ clipId: 'a', in: 0, out: 2, speed: 2 }] }, { lineId: 'l1', shots: [{ clipId: 'b', in: 0, out: 2.35 }] }] }
    const { plan } = repairPlan(raw, makeCtx(clips.slice(0, 2), script))
    expect(plan.scenes[0].shots[0].speed).toBe(2)
    expect(sumShots(plan.scenes[0].shots)).toBeCloseTo(sumShots(base.scenes[0].shots), 2)
  })
})

describe('user edits in a narrated scene', () => {
  it('a freeze frame survives re-fitting and the scene keeps its length', async () => {
    const { refitPlan } = await import('./repair')
    const ctx2 = makeCtx(clips.slice(0, 2), script)
    const target = sumShots(base.scenes[0].shots)
    const s0 = base.scenes[0].shots[0]
    const mid = s0.in + 0.6
    const edited = { ...base, scenes: [{ ...base.scenes[0], shots: [{ ...s0, out: mid }, { ...s0, id: 'h', in: mid, out: mid, hold: 1 }, { ...s0, id: 'r', in: mid }] }, base.scenes[1]] }
    const fixed = refitPlan(edited, ctx2)
    expect(fixed.scenes[0].shots.some((x) => x.hold)).toBe(true)
    expect(sumShots(fixed.scenes[0].shots)).toBeCloseTo(target, 2)
  })
  it('slow motion on a short shot is not stretched to double length', async () => {
    const { refitPlan } = await import('./repair')
    const s0 = base.scenes[0].shots[0]
    const edited = { ...base, scenes: [{ ...base.scenes[0], shots: [{ ...s0, out: s0.in + 0.3, speed: 0.5 }, { ...s0, id: 'x', clipId: 'b', in: 0, out: 2 }] }, base.scenes[1]] }
    const fixed = refitPlan(edited, makeCtx(clips.slice(0, 2), script))
    expect(fixed.scenes[0].shots[0].out - fixed.scenes[0].shots[0].in).toBeCloseTo(0.4, 2)
  })
})
