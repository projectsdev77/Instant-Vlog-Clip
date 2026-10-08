import { describe, expect, it } from 'vitest'
import { repairPlan } from '@/domain/repair'
import { makeClip, makeCtx, makeScript } from '@/test/fixtures'
import { buildCatalog } from './catalog'
import { mockAi } from './mock'

describe('mock AI', () => {
  const clips = [makeClip('coffee', 6, { fileName: 'coffee-closeup.mp4' }), makeClip('park', 8, { fileName: 'park-bike.mp4' }), makeClip('sun', 5, { fileName: 'sunset.mp4' })]

  it('writes a hook, story lines and an outro grounded in the clips', async () => {
    const r = await mockAi.writeScript({ mode: 'write', language: 'en', title: '', prompt: 'a lazy Sunday in Lisbon', lines: [], targetSec: 'auto', vibe: 'auto', catalog: buildCatalog(clips) })
    expect(r.title).toBe('A lazy Sunday in Lisbon')
    expect(r.lines[0].purpose).toBe('hook')
    expect(r.lines[r.lines.length - 1].purpose).toBe('outro')
    expect(r.lines.some((l) => l.text.toLowerCase().includes('coffee'))).toBe(true)
  })

  it('polishes user lines without changing their meaning', async () => {
    const r = await mockAi.writeScript({ mode: 'polish', language: 'en', title: 'X', prompt: '', lines: ['- woke up early', 'biked thru the park  '], targetSec: 'auto', vibe: 'auto', catalog: [] })
    expect(r.lines.map((l) => l.text)).toEqual(['Woke up early.', 'Biked thru the park.'])
  })

  it('returns a plan that repairs cleanly', async () => {
    const script = makeScript(['Coffee first.', 'Then the park.', 'Sunset to finish.'])
    const raw = await mockAi.planEdit({
      aspect: '9:16',
      vibe: 'auto',
      narrated: true,
      lines: script.lines.map((l) => ({ lineId: l.id, text: l.text, visualIntent: l.visualIntent, sceneSec: 2.35 })),
      targetSec: 30,
      catalog: buildCatalog(clips),
      feedback: 'start with the sunset',
    })
    const { issues, plan } = repairPlan(raw, makeCtx(clips, script))
    expect(issues).toEqual([])
    expect(plan.scenes[0].shots[0].clipId).toBe('sun')
  })
})
