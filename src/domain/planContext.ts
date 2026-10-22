import { resolveTemplate } from './templates'
import { lineSceneDuration } from './timing'
import type { Clip, ProjectSettings, Script, ScriptLine, VoiceMode } from './types'

/** Everything needed to build or check an edit plan. */
export type PlanContext = {
  clips: Clip[]
  script?: Script
  voiceMode: VoiceMode
  settings: ProjectSettings
  title: string
  musicTrackId: string | null
  musicGainDb: number
  /** scene length per line when the user recorded over a fixed timing ("Record my own") */
  sceneSec?: Map<string, number>
  /** when making the vlog over a recording: exactly these scenes, in this order, with these lengths */
  fixedLayout?: { lineId?: string; sec: number }[]
}

/** How long the scene carrying `line` lasts. */
export function sceneDuration(ctx: Pick<PlanContext, 'voiceMode' | 'sceneSec'>, line: ScriptLine): number {
  return ctx.sceneSec?.get(line.id) ?? lineSceneDuration(line, ctx.voiceMode)
}

/** Clips worth showing: readable and not accidental (pocket shots, floor, etc.). */
export function usableClips(clips: Clip[]): Clip[] {
  return clips.filter((c) => c.durationSec > 0.3 && !c.analysis?.quality.accidental)
}

/** Total length of the narrated scenes. */
export function narrationSec(ctx: Pick<PlanContext, 'script' | 'voiceMode' | 'sceneSec'>): number {
  return (ctx.script?.lines ?? []).reduce((a, l) => a + sceneDuration(ctx, l), 0)
}

/**
 * How long the vlog should be. A chosen length is kept unless the narration is
 * longer (speech is never cut). "Auto" is the narration plus about one shot for
 * each clip the narration doesn't cover, or, with no narration, a length that
 * fits the footage. "Use every clip" can still push the result past a chosen
 * length (see repair).
 */
export function videoTargetSec(ctx: PlanContext): number {
  const speech = narrationSec(ctx)
  if (ctx.settings.targetSec !== 'auto') return Math.max(ctx.settings.targetSec, speech)
  if (speech > 0) {
    const extra = Math.max(0, usableClips(ctx.clips).length - (ctx.script?.lines.length ?? 0))
    return Math.round(Math.min(90, speech + extra * vibeShotLength(ctx.settings)))
  }
  const footage = usableClips(ctx.clips).length * vibeShotLength(ctx.settings) * 1.5
  return Math.round(Math.min(60, Math.max(10, footage)))
}

export function vibeShotLength(settings: ProjectSettings): number {
  if (settings.template && settings.template !== 'auto') return resolveTemplate(settings.template, settings.vibe).shotSec
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
