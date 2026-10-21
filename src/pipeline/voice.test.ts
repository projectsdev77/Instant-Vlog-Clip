import { describe, expect, it } from 'vitest'
import type { Project } from '@/domain/types'
import { makeScript } from '@/test/fixtures'
import { linesNeedingVoice } from './voice'

const project = (script = makeScript(['one', 'two'])): Project => ({ script, voice: { mode: 'ai', voiceId: 'v1', volumeDb: 0 } }) as unknown as Project

describe('linesNeedingVoice', () => {
  it('skips muted lines and re-voices a line whose delivery changed', () => {
    const script = makeScript(['one', 'two', 'three'])
    for (const l of script.lines) l.audio = { ...l.audio!, voiceId: 'v1' }
    expect(linesNeedingVoice(project(script))).toEqual([])
    script.lines[0].muted = true
    script.lines[0].audio = undefined
    script.lines[1].delivery = 'calm'
    script.lines[2].seed = 7
    expect(linesNeedingVoice(project(script)).map((l) => l.id)).toEqual(['l1', 'l2'])
  })
})
