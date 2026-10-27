import { describe, expect, it } from 'vitest'
import { makeClip } from '@/test/fixtures'
import { fitShots, shotLength } from './shots'
import type { Shot } from './types'

const base = { crop: { focusX: 0.5, focusY: 0.5, zoom: 1 }, clipAudio: 'mute' as const, transitionIn: 'cut' as const }

describe('fitShots', () => {
  it('trims a frozen end that is shorter than a moving shot instead of dropping it', () => {
    const clips = new Map([['c1', makeClip('c1', 9)]])
    const shots: Shot[] = [
      { ...base, id: 'a', clipId: 'c1', in: 4, out: 4.85 },
      { ...base, id: 'h', clipId: 'c1', in: 4.85, out: 4.85, hold: 0.65 },
    ]
    // a couple of milliseconds too long, as rounding leaves it
    const { shots: out } = fitShots(shots, 1.498, clips)
    expect(out.map((s) => s.id)).toEqual(['a', 'h'])
    expect(out.reduce((t, s) => t + shotLength(s), 0)).toBeCloseTo(1.498, 3)
  })
})
