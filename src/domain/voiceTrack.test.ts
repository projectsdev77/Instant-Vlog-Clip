import { describe, expect, it } from 'vitest'
import { makeClip, makeCtx, makeScript } from '@/test/fixtures'
import { repairPlan } from './repair'
import { sumShots } from './shots'
import { buildTimeline } from './timeline'
import type { EditPlan, VoiceTake } from './types'
import { resolveTakes, scriptFromSpeech, splitTake, takeEnd, trackWords, trimTake } from './voiceTrack'

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
    const tl = buildTimeline(plan, new Map(clips.map((c) => [c.id, c])), script, 'recorded', { takes: [take('t', 1, 2, 1, words)] })
    expect(tl.voice).toEqual([{ lineId: '', start: 1, mediaKey: 'm-t', durationSec: 2, offset: 0, gain: 1 }])
    expect(tl.captions.flatMap((c) => c.words.map((w) => w.word))).toEqual(['what', 'I', 'said'])
    expect(tl.speech).toEqual([[1, 3]])
  })
})

describe('script from what was said', () => {
  const shot = (clipId: string, len: number) => ({ id: `s-${clipId}`, clipId, in: 0, out: len, crop: { focusX: 0.5, focusY: 0.5, zoom: 1 }, clipAudio: 'duck' as const, transitionIn: 'cut' as const })
  // scenes: 0-3 line l0 · 3-5 footage only · 5-8 line l1 · 8-10 line l2
  const plan = { scenes: [{ id: 'a', lineId: 'l0', shots: [shot('a', 3)] }, { id: 'b', shots: [shot('b', 2)] }, { id: 'c', lineId: 'l1', shots: [shot('c', 3)] }, { id: 'd', lineId: 'l2', shots: [shot('d', 2)] }] } as unknown as EditPlan
  const script = makeScript(['Coffee first.', 'A walk in the park.', 'Good night.'], false)
  const w = (word: string, start: number) => ({ word, start, end: start + 0.4 })
  const said = (t: VoiceTake) => ({ ...t, transcript: 'done' as const })

  it('replaces the lines of recorded parts with what was said, keeps the rest', () => {
    // one take over 0-7 s: says "hello there" in scene 1, "ice cream" in the footage-only scene, nothing in scene 3
    const t = said(take('t', 0, 7, 1, [w('hello', 0.5), w('there', 1), w('ice', 3.4), w('cream', 4)]))
    const r = scriptFromSpeech(plan, script.lines, [t])
    expect(r.changed).toEqual([0, 1, 2])
    expect(r.scenes.map((s) => s.lineId && r.lines.find((l) => l.id === s.lineId)?.text)).toEqual(['hello there', 'ice cream', undefined, 'Good night.'])
    expect(r.lines.map((l) => l.text)).toEqual(['hello there', 'ice cream', 'Good night.'])
    expect(r.scenes.map((s) => sumShots(s.shots))).toEqual([3, 2, 3, 2])
  })

  it('leaves everything alone until a take has its captions', () => {
    const r = scriptFromSpeech(plan, script.lines, [take('t', 0, 7, 1, [w('hello', 0.5)])])
    expect(r.changed).toEqual([])
    expect(r.lines.map((l) => l.text)).toEqual(script.lines.map((l) => l.text))
  })
})
