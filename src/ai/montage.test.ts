import { describe, expect, it } from 'vitest'
import { repairPlan } from '@/domain/repair'
import { sumShots } from '@/domain/shots'
import { makeClip, makeCtx } from '@/test/fixtures'
import type { LocalSignals } from '@/domain/types'
import { buildCatalog } from './catalog'
import { mockAi } from './mock'

const signals = (dur: number): LocalSignals => {
  const n = Math.round(dur)
  const t = Array.from({ length: n }, (_, i) => i + 0.5)
  return { sampleTimes: t, sharpness: t.map((_, i) => 0.01 + (i % 3) * 0.01), brightness: t.map(() => 0.5), motion: t.map(() => 0.1), speechRatio: 0, hashes: t.map(() => '0'.repeat(16)) }
}

describe('no-script montage', () => {
  it('builds a montage from the best unique footage through mock planner + repair', async () => {
    const clips = [6, 8, 8, 9].map((d, i) => makeClip(`c${i}`, d, { signals: signals(d), fileName: `clip${i}.webm` }))
    const ctx = makeCtx(clips, undefined, { voiceMode: 'none' })
    const raw = await mockAi.planEdit({ aspect: '9:16', vibe: 'auto', narrated: false, lines: [], targetSec: 30, catalog: buildCatalog(clips) })
    const { plan, issues } = repairPlan(raw, ctx)
    const total = plan.scenes.reduce((a, s) => a + sumShots(s.shots), 0)
    expect(issues).toEqual([])
    // uses the best footage without repeating it, up to the 30 s target
    expect(total).toBeGreaterThan(15)
    expect(total).toBeLessThanOrEqual(30.01)
  })
})
