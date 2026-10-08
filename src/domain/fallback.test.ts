import { describe, expect, it } from 'vitest'
import { makeClip, makeCtx, makeScript } from '@/test/fixtures'
import { planFallback } from './fallback'
import { sumShots } from './shots'

describe('planFallback', () => {
  it('builds one scene per line', () => {
    const clips = [makeClip('a', 8), makeClip('b', 8)]
    const plan = planFallback(makeCtx(clips, makeScript(['one', 'two', 'three'])))
    expect(plan.scenes.map((s) => s.lineId)).toEqual(['l0', 'l1', 'l2'])
  })

  it('without a script fills the target length and never repeats footage', () => {
    const clips = [makeClip('a', 20), makeClip('b', 20)]
    const plan = planFallback(makeCtx(clips, undefined, { voiceMode: 'none' }))
    const total = plan.scenes.reduce((a, s) => a + sumShots(s.shots), 0)
    expect(total).toBeGreaterThan(5)
    expect(total).toBeLessThanOrEqual(30.01)
  })

  it('stops instead of looping when footage runs out', () => {
    const plan = planFallback(makeCtx([makeClip('a', 2)], undefined, { voiceMode: 'none' }))
    expect(plan.scenes.length).toBe(1)
  })

  it('prefers clips whose analysis matches the line', () => {
    const clips = [
      makeClip('beach', 6, { analysis: { description: 'waves on a sandy beach', tags: ['beach'], shotType: 'wide', quality: { shaky: false, blurry: false, dark: false, accidental: false }, moments: [{ start: 0, end: 4, score: 0.5, why: '', focus: { x: 0.5, y: 0.5 } }] } }),
      makeClip('coffee', 6, { analysis: { description: 'latte art coffee cup', tags: ['coffee'], shotType: 'closeup', quality: { shaky: false, blurry: false, dark: false, accidental: false }, moments: [{ start: 0, end: 4, score: 0.5, why: '', focus: { x: 0.5, y: 0.5 } }] } }),
    ]
    const plan = planFallback(makeCtx(clips, makeScript(['Grabbed a coffee first.'])))
    expect(plan.scenes[0].shots[0].clipId).toBe('coffee')
  })
})
