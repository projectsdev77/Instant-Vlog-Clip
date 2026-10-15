import { lineSceneDuration } from './timing'
import type { Clip, ProjectSettings, Script, VoiceMode } from './types'

/** Everything needed to build or check an edit plan. */
export type PlanContext = {
  clips: Clip[]
  script?: Script
  voiceMode: VoiceMode
  settings: ProjectSettings
  title: string
  musicTrackId: string | null
  musicGainDb: number
}

/** Clips worth showing: readable and not accidental (pocket shots, floor, etc.). */
export function usableClips(clips: Clip[]): Clip[] {
  return clips.filter((c) => c.durationSec > 0.3 && !c.analysis?.quality.accidental)
}

/** Total length of the narrated scenes. */
export function narrationSec(ctx: Pick<PlanContext, 'script' | 'voiceMode'>): number {
  return (ctx.script?.lines ?? []).reduce((a, l) => a + lineSceneDuration(l, ctx.voiceMode), 0)
}

/**
 * How long the vlog should be. A chosen length is kept unless the narration is
 * longer (speech is never cut). "Auto" is the narration plus room to show
 * every clip, or, with no narration, a length that fits the footage.
 * Showing every usable clip can still push the result past this (see repair).
 */
export function videoTargetSec(ctx: PlanContext): number {
  const speech = narrationSec(ctx)
  if (ctx.settings.targetSec !== 'auto') return Math.max(ctx.settings.targetSec, speech)
  if (speech > 0) return speech
  const footage = usableClips(ctx.clips).length * vibeShotLength(ctx.settings) * 1.5
  return Math.round(Math.min(60, Math.max(10, footage)))
}

export function vibeShotLength(settings: ProjectSettings): number {
  switch (settings.vibe) {
    case 'upbeat':
    case 'funny':
      return 1.6
    case 'chill':
    case 'cinematic':
    case 'aesthetic':
      return 3.2
    default:
      return 2.4
  }
}

export function vibeTransition(settings: ProjectSettings) {
  return settings.vibe === 'chill' || settings.vibe === 'cinematic' || settings.vibe === 'aesthetic' ? 'crossfade' : 'cut'
}
