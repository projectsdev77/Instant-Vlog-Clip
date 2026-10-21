import { describe, expect, it } from 'vitest'
import { mockAi } from './mock'

const polish = async (lines: string[]) =>
  (await mockAi.writeScript({ mode: 'polish', language: 'en', title: 'T', prompt: '', lines, targetSec: 'auto', vibe: 'auto', catalog: [] })).lines.map((l) => l.text)

describe('demo polish', () => {
  it('fixes common slips and keeps one line per line', async () => {
    const out = await polish(['i went to teh park and it was the the best!!!', 'dont know why im so tired', 'Already fine.'])
    expect(out).toEqual(['I went to the park and it was the best!', "Don't know why I'm so tired.", 'Already fine.'])
  })
})
