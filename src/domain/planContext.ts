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

export function targetTotalSec(settings: ProjectSettings): number {
  return settings.targetSec === 'auto' ? 30 : settings.targetSec
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
