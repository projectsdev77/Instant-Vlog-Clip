import { describe, expect, it } from 'vitest'
import { makeClip, makeCtx, makeScript } from '@/test/fixtures'
import { repairPlan } from './repair'
import { sumShots } from './shots'
import { buildTimeline } from './timeline'
import type { VoiceTake } from './types'
import { layoutIsStale, resolveTakes, splitTake, takeEnd, trackWords, trimTake } from './voiceTrack'

const take = (id: string, start: number, len: number, createdAt: number, words: VoiceTake['words'] = []): VoiceTake => ({
  id, mediaKey: `m-${id}`, start, in: 0, out: len, durationSec: len, volume: 1, createdAt, peaks: [], words,
})

describe('voice track', () => {
  it('newer takes win where takes overlap', () => {
    const segs = resolveTakes([take('a', 0, 10, 1), take('b', 4, 2, 2)])
    expect(segs.map((g) => [g.take.id, g.start, g.end, g.offset])).toEqual([
      ['a', 0, 4, 0],
      ['b', 4, 6, 0],
      ['a', 6, 10, 6],
    ])
  })

  it('splits and trims inside the recording', () => {
    const [l, r] = splitTake(take('a', 2, 6, 1), 5)
    expect([l.start, l.in, l.out, takeEnd(l)]).toEqual([2, 0, 3, 5])
    expect([r.start, r.in, r.out, takeEnd(r)]).toEqual([5, 3, 6, 8])
    const t = trimTake(take('a', 2, 6, 1), 'in', 3)
    expect([t.start, t.in, takeEnd(t)]).toEqual([3, 1, 8])
    expect(trimTake(take('a', 2, 6, 1), 'out', 20).out).toBe(6) // can't go past the recording
  })

  it('places spoken words on the timeline and drops words that were cut', () => {
    const words = [
      { word: 'hello', start: 0.2, end: 0.6 },
      { word: 'cut', start: 1.2, end: 1.5 },
      { word: 'there', start: 2.2, end: 2.6 },
    ]
    const segs = resolveTakes([take('a', 10, 3, 1, words), take('b', 11, 1, 2)])
    expect(trackWords(segs).map((w) => [w.word, w.start])).toEqual([
      ['hello', 10.2],
      ['there', 12.2],
    ])
  })

  it('notices when the script changed after recording', () => {
    const track = { takes: [], layout: [{ lineId: 'l0', sec: 2 }, { sec: 3 }, { lineId: 'l1', sec: 2 }] }
    expect(layoutIsStale(track, ['l0', 'l1'])).toBe(false)
    expect(layoutIsStale(track, ['l0', 'l2'])).toBe(true)
  })
})

describe('making the vlog over a recording', () => {
  const clips = ['a', 'b', 'c'].map((id, i) => makeClip(id, 12, { addedAt: i }))
  const script = makeScript(['First line.', 'Second line.'], false)
  const layout = [{ lineId: 'l0', sec: 3.2 }, { sec: 2.5 }, { lineId: 'l1', sec: 4 }, { sec: 1.5 }]
  const ctx = makeCtx(clips, script, { voiceMode: 'recorded', sceneSec: new Map([['l0', 3.2], ['l1', 4]]), fixedLayout: layout })

  it('keeps every scene in place with the recorded length, whatever the AI returns', () => {
    const raw = { scenes: [{ lineId: 'l1', shots: [{ clipId: 'b', in: 0, out: 1 }] }, { lineId: '', shots: [{ clipId: 'c', in: 2, out: 9 }] }] }
    const { plan } = repairPlan(raw, ctx)
    expect(plan.scenes.map((s) => [s.lineId ?? '', +sumShots(s.shots).toFixed(2)])).toEqual([
      ['l0', 3.2],
      ['', 2.5],
      ['l1', 4],
      ['', 1.5],
    ])
  })

  it('takes voice and captions from the recording', () => {
    const { plan } = repairPlan({ scenes: [] }, ctx)
    const words = [{ word: 'what', start: 0.1, end: 0.4 }, { word: 'I', start: 0.5, end: 0.6 }, { word: 'said', start: 0.7, end: 1 }]
    const tl = buildTimeline(plan, new Map(clips.map((c) => [c.id, c])), script, 'recorded', { layout, takes: [take('t', 1, 2, 1, words)] })
    expect(tl.voice).toEqual([{ lineId: '', start: 1, mediaKey: 'm-t', durationSec: 2, offset: 0, gain: 1 }])
    expect(tl.captions.flatMap((c) => c.words.map((w) => w.word))).toEqual(['what', 'I', 'said'])
    expect(tl.speech).toEqual([[1, 3]])
  })
})
