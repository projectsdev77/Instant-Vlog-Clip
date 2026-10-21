import { describe, expect, it } from 'vitest'
import { makeClip } from '@/test/fixtures'
import { pickFootage } from './pickFootage'
import { sumShots } from './shots'
import type { ClipAnalysis, EditPlan } from './types'

const analysis = (description: string, tags: string[]): ClipAnalysis => ({
  description,
  tags,
  shotType: 'wide',
  quality: { shaky: false, blurry: false, dark: false, accidental: false },
  moments: [{ start: 1, end: 4, score: 0.6, why: 'Nice moment', focus: { x: 0.5, y: 0.5 } }],
})

describe('pickFootage', () => {
  const clips = [
    makeClip('street', 10, { analysis: { ...analysis('A busy city street at night', ['street', 'city']), moments: [{ start: 1, end: 4, score: 0.9, why: 'Neon lights', focus: { x: 0.5, y: 0.5 } }] } }),
    makeClip('coffee', 10, { analysis: analysis('Pouring coffee into a mug in a cafe', ['coffee', 'cafe']) }),
  ]
  const plan = { scenes: [{ id: 's0', shots: [] }, { id: 's1', lineId: 'l1', shots: [] }] } as unknown as EditPlan

  it('picks footage that matches the words, exactly as long as the scene', () => {
    const shots = pickFootage('Grabbing my morning coffee.', clips, plan, 1, 3.4)
    expect(shots[0].clipId).toBe('coffee')
    expect(sumShots(shots)).toBeCloseTo(3.4, 2)
  })

  it('falls back to the best-looking footage when nothing matches', () => {
    const shots = pickFootage('Hello everyone!', clips, plan, 1, 2)
    expect(shots[0].clipId).toBe('street')
    expect(sumShots(shots)).toBeCloseTo(2, 2)
  })
})
