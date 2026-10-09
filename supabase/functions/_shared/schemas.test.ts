import { describe, expect, it } from 'vitest'
import { analyzeClipSchema, forClaude, forGemini, planSchema } from './schemas.ts'
import { analyzeChecklist, planChecklist, scriptChecklist } from './prompts.ts'

const text = (x: unknown) => JSON.stringify(x)

describe('provider schemas', () => {
  it('strips limits Claude rejects, without touching the source schema', () => {
    const c = forClaude(planSchema)
    expect(text(c)).not.toMatch(/minimum|maximum|minItems|maxItems|propertyOrdering/)
    expect(text(planSchema)).toMatch(/maxItems/)
    expect(text(c)).toMatch(/"additionalProperties":false/)
  })

  it('keeps limits for Gemini and orders fields as declared', () => {
    const g = forGemini(analyzeClipSchema) as { propertyOrdering: string[]; properties: { moments: { items: { propertyOrdering: string[] }; maxItems: number } } }
    expect(g.propertyOrdering).toEqual(['description', 'tags', 'shotType', 'quality', 'moments'])
    expect(g.properties.moments.items.propertyOrdering.slice(0, 2)).toEqual(['start', 'end'])
    expect(g.properties.moments.maxItems).toBe(5)
  })
})

describe('Gemini checklists', () => {
  const catalog = [
    { clipId: 'c1', durationSec: 8, description: 'coffee', tags: [], shotType: 'closeup' as const, mustInclude: true, unusable: false, moments: [] },
    { clipId: 'c2', durationSec: 6.5, description: 'park', tags: [], shotType: 'pov' as const, mustInclude: false, unusable: false, moments: [] },
  ]

  it('fills in the clip length for moment checks', () => {
    expect(analyzeChecklist({ clipId: 'c1', fileName: 'a.mp4', durationSec: 8, contactSheetBase64: '', frameTimes: [], speechRatio: 0 })).toContain('≤ 8.0')
  })

  it('states word budget and must-include clips for scripts', () => {
    const c = scriptChecklist({ mode: 'write', language: 'en', title: '', prompt: '', lines: [], targetSec: 30, vibe: 'auto', catalog })
    expect(c).toContain('about 75 words')
    expect(c).toContain('must-include clips each get a line: c1')
  })

  it('lists allowed clips and exact scene lengths for the planner', () => {
    const c = planChecklist({ aspect: '9:16', vibe: 'auto', narrated: true, targetSec: 30, catalog, lines: [{ lineId: 'l1', text: 'x', visualIntent: 'x', sceneSec: 2.35 }] })
    expect(c).toContain('c1 (0–8.0s), c2 (0–6.5s)')
    expect(c).toContain('lineId l1: shots add up to 2.35s')
  })
})
