import type { WordWire } from './contracts.ts'

export type Alignment = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }

/** Character-level TTS timings → word timings. */
export function wordsFromAlignment(a: Alignment): WordWire[] {
  const words: WordWire[] = []
  let cur = ''
  let start = 0
  let end = 0
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push({ word: cur, start, end })
      cur = ''
      return
    }
    if (!cur) start = a.character_start_times_seconds[i]
    cur += ch
    end = a.character_end_times_seconds[i]
  })
  if (cur) words.push({ word: cur, start, end })
  return words
}
