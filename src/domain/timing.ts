import { textHash } from './ids'
import type { ScriptLine, VoiceMode, Word } from './types'

/** Silence before / after each narration line inside its scene. */
export const LINE_LEAD_IN = 0.1
export const LINE_TAIL = 0.25
export const WORDS_PER_SECOND = 2.6
export const MIN_SHOT = 0.8
export const MAX_SHOT = 6
export const MIN_SCENE = 1.6

export function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

export function estimateSpeechSec(text: string): number {
  return Math.max(1, words(text).length / WORDS_PER_SECOND)
}

export function hasFreshAudio(line: ScriptLine): boolean {
  return !!line.audio && line.audio.textHash === textHash(line.text)
}

/** Length of the scene that carries this line. */
export function lineSceneDuration(line: ScriptLine, mode: VoiceMode): number {
  const speech = mode !== 'none' && hasFreshAudio(line) ? line.audio!.durationSec : estimateSpeechSec(line.text)
  return Math.max(MIN_SCENE, LINE_LEAD_IN + speech + LINE_TAIL)
}

/** Evenly spaced word timings when there's no audio to align to. */
export function estimatedWords(text: string, offset = 0): Word[] {
  const ws = words(text)
  const total = estimateSpeechSec(text)
  const step = total / Math.max(1, ws.length)
  return ws.map((w, i) => ({ word: w, start: offset + i * step, end: offset + (i + 1) * step }))
}

export function lineWords(line: ScriptLine, mode: VoiceMode): Word[] {
  if (mode !== 'none' && hasFreshAudio(line)) return line.audio!.words
  return estimatedWords(line.text)
}
