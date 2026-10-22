import { describe, expect, it } from 'vitest'
import type { EditPlan, Scene } from './types'
import { keepUserScenes, withUserScene } from './userScenes'

const shot = (clipId: string) => ({ id: `s-${clipId}`, clipId, in: 0, out: 2, crop: { focusX: 0.5, focusY: 0.5, zoom: 1 }, clipAudio: 'duck' as const, transitionIn: 'cut' as const })
const scene = (id: string, clipId: string, lineId?: string): Scene => ({ id, lineId, shots: [shot(clipId)] })
const plan = (scenes: Scene[], userScenes?: string[]) => ({ scenes, userScenes }) as unknown as EditPlan
const clips = (p: EditPlan) => p.scenes.map((s) => `${s.lineId ?? '-'}:${s.shots[0].clipId}`)

describe('keepUserScenes', () => {
  it('keeps hand-picked footage under the same line and in its footage-only spot', () => {
    const current = plan([scene('a', 'mine1', 'l0'), scene('b', 'mine2'), scene('c', 'x', 'l1')], ['a', 'b'])
    const next = plan([scene('n1', 'ai1', 'l1'), scene('n2', 'ai2', 'l0'), scene('n3', 'ai3')])
    const r = keepUserScenes(current, next)
    expect(clips(r)).toEqual(['l1:ai1', 'l0:mine1', '-:mine2'])
    expect(r.userScenes).toEqual(['n2', 'b'])
  })

  it('keeps the same slot when the layout is unchanged (own voice timing)', () => {
    const current = plan([scene('a', 'x', 'l0'), scene('b', 'mine'), scene('c', 'y', 'l1')], ['b'])
    const next = plan([scene('n1', 'ai1', 'l0'), scene('n2', 'ai2'), scene('n3', 'ai3', 'l1')])
    expect(clips(keepUserScenes(current, next))).toEqual(['l0:ai1', '-:mine', 'l1:ai3'])
  })

  it('changes nothing when the user picked nothing, and marks a scene once', () => {
    const next = plan([scene('n1', 'ai1', 'l0')])
    expect(keepUserScenes(plan([scene('a', 'x', 'l0')]), next)).toBe(next)
    expect(withUserScene(withUserScene(plan([]), 'a'), 'a').userScenes).toEqual(['a'])
  })
})
