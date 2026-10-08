import { describe, expect, it } from 'vitest'
import { makeClip, makeCtx, makeScript } from '@/test/fixtures'
import { repairPlan } from './repair'
import { sumShots } from './shots'
import { lineSceneDuration } from './timing'

const clips = [makeClip('a', 10), makeClip('b', 6), makeClip('c', 3)]
const script = makeScript(['I woke up early.', 'Then coffee.', 'Best day ever.'])
const ctx = makeCtx(clips, script)
const target = lineSceneDuration(script.lines[0], 'ai')

describe('repairPlan', () => {
  it('keeps a valid plan and makes each scene cover its line exactly', () => {
    const raw = {
      scenes: script.lines.map((l, i) => ({ lineId: l.id, shots: [{ clipId: clips[i].id, in: 0, out: 2.35 }] })),
    }
    const { plan, issues, usedFallback } = repairPlan(raw, ctx)
    expect(usedFallback).toBe(false)
    expect(issues).toEqual([])
    expect(plan.scenes).toHaveLength(3)
    for (const scene of plan.scenes) expect(sumShots(scene.shots)).toBeCloseTo(target, 2)
  })

  it('clamps in/out points to the clip and reports it', () => {
    const raw = { scenes: [{ lineId: 'l0', shots: [{ clipId: 'c', in: 2, out: 9 }] }] }
    const { plan, issues } = repairPlan(raw, ctx)
    const shot = plan.scenes[0].shots[0]
    expect(shot.out).toBeLessThanOrEqual(3)
    expect(issues.some((i) => i.includes('outside clip'))).toBe(true)
  })

  it('drops unknown clips and fills lines that have no scene', () => {
    const raw = { scenes: [{ lineId: 'l0', shots: [{ clipId: 'nope', in: 0, out: 2 }] }] }
    const { plan, issues } = repairPlan(raw, ctx)
    expect(plan.scenes.map((s) => s.lineId)).toEqual(['l0', 'l1', 'l2'])
    expect(plan.scenes.every((s) => s.shots.length > 0)).toBe(true)
    expect(issues.some((i) => i.includes('unknown clipId'))).toBe(true)
    expect(issues.some((i) => i.includes('has no scene'))).toBe(true)
  })

  it('removes repeated footage', () => {
    const raw = {
      scenes: [
        { lineId: 'l0', shots: [{ clipId: 'a', in: 0, out: 2.35 }] },
        { lineId: 'l1', shots: [{ clipId: 'a', in: 0.1, out: 2.4 }] },
        { lineId: 'l2', shots: [{ clipId: 'b', in: 0, out: 2.35 }] },
      ],
    }
    const { plan, issues } = repairPlan(raw, ctx)
    expect(issues.some((i) => i.includes('repeats'))).toBe(true)
    const s1 = plan.scenes[1].shots[0]
    expect(s1.clipId === 'a' && s1.in < 2.35).toBe(false)
  })

  it('falls back to a rule-based edit for garbage', () => {
    const { plan, usedFallback } = repairPlan('nonsense', ctx)
    expect(usedFallback).toBe(true)
    expect(plan.createdBy).toBe('fallback')
    expect(plan.scenes).toHaveLength(3)
  })

  it('extends with extra shots when one clip is too short for a line', () => {
    const short = [makeClip('x', 1), makeClip('y', 1.2), makeClip('z', 5)]
    const s = makeScript(['A long line that needs a lot of footage to cover it well.'])
    s.lines[0].audio!.durationSec = 4
    const { plan } = repairPlan({ scenes: [{ lineId: 'l0', shots: [{ clipId: 'x', in: 0, out: 1 }] }] }, makeCtx(short, s))
    expect(sumShots(plan.scenes[0].shots)).toBeCloseTo(lineSceneDuration(s.lines[0], 'ai'), 2)
  })
})
