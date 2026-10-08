import { describe, expect, it } from 'vitest'
import { makeClip, makeCtx, makeScript } from '@/test/fixtures'
import { planFallback } from './fallback'
import { buildTimeline, chunkWords, shotAt } from './timeline'

describe('timeline', () => {
  it('lays shots end to end and places narration inside its scene', () => {
    const clips = [makeClip('a', 8), makeClip('b', 8)]
    const script = makeScript(['one', 'two'])
    const plan = planFallback(makeCtx(clips, script))
    const tl = buildTimeline(plan, new Map(clips.map((c) => [c.id, c])), script, 'ai')
    expect(tl.shots[0].start).toBe(0)
    for (let i = 1; i < tl.shots.length; i++) expect(tl.shots[i].start).toBeCloseTo(tl.shots[i - 1].end, 5)
    expect(tl.voice).toHaveLength(2)
    expect(tl.voice[1].start).toBeGreaterThan(tl.scenes[1].start)
    expect(shotAt(tl, tl.duration - 0.01)).toBe(tl.shots[tl.shots.length - 1])
  })

  it('chunks captions on punctuation and word limits', () => {
    const ws = 'So I woke up early, grabbed coffee and then biked through the park.'.split(' ').map((w, i) => ({ word: w, start: i * 0.3, end: i * 0.3 + 0.3 }))
    const chunks = chunkWords(ws, 10)
    expect(chunks[0].words.map((w) => w.word).join(' ')).toBe('So I woke up')
    expect(chunks[1].words.map((w) => w.word).join(' ')).toBe('early,')
    expect(chunks.every((c) => c.words.length <= 4)).toBe(true)
    for (let i = 0; i < chunks.length - 1; i++) expect(chunks[i].end).toBe(chunks[i + 1].start)
  })
})
