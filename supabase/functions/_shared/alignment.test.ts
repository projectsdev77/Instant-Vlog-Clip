import { describe, expect, it } from 'vitest'
import { wordsFromAlignment } from './alignment.ts'

describe('wordsFromAlignment', () => {
  it('groups characters into timed words', () => {
    const text = 'Hi there!'
    const chars = [...text]
    const words = wordsFromAlignment({
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1),
      character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
    })
    expect(words).toEqual([
      { word: 'Hi', start: 0, end: 0.2 },
      { word: 'there!', start: 0.30000000000000004, end: 0.9 },
    ])
  })
})
