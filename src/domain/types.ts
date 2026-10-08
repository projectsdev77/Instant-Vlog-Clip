/**
 * Core domain model. The EditPlan (EDL) is the single source of truth the
 * renderer plays; the AI proposes one, code validates and repairs it.
 */

export type Aspect = '9:16' | '1:1' | '16:9'
export type Vibe = 'auto' | 'chill' | 'upbeat' | 'cinematic' | 'funny' | 'aesthetic'
export type TargetLength = 'auto' | 15 | 30 | 60
export type Language = 'en'

export type ProjectSettings = {
  aspect: Aspect
  targetSec: TargetLength
  vibe: Vibe
  language: Language
}

export type Word = { word: string; start: number; end: number }
export type Transcript = { text: string; words: Word[] }

export type FocusPoint = { x: number; y: number }

export type Moment = {
  start: number
  end: number
  /** 0..1, higher is better */
  score: number
  why: string
  focus: FocusPoint
}

export type ShotType = 'talking_head' | 'wide' | 'closeup' | 'pov' | 'pan' | 'other'

export type ClipAnalysis = {
  description: string
  tags: string[]
  shotType: ShotType
  quality: { shaky: boolean; blurry: boolean; dark: boolean; accidental: boolean }
  moments: Moment[]
}

/** Cheap signals computed on device, one value per sampled frame. */
export type LocalSignals = {
  sampleTimes: number[]
  sharpness: number[]
  brightness: number[]
  motion: number[]
  /** 0..1 share of the clip with voice activity */
  speechRatio: number
  /** perceptual hash per sample, hex */
  hashes: string[]
  duplicateOf?: string
}

export type ClipStatus = 'importing' | 'ready' | 'analyzing' | 'analyzed' | 'error'

export type Clip = {
  id: string
  projectId: string
  fileName: string
  mime: string
  sizeBytes: number
  /** key into the local media store (OPFS / IndexedDB), never uploaded */
  mediaKey: string
  durationSec: number
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
  hasAudio: boolean
  recordedAt?: string
  addedAt: number
  mustInclude: boolean
  status: ClipStatus
  error?: string
  /** small JPEG data URL */
  thumbnail?: string
  /** grid of sampled frames sent to the AI instead of video, JPEG data URL */
  contactSheet?: { dataUrl: string; times: number[] }
  signals?: LocalSignals
  analysis?: ClipAnalysis
  transcript?: Transcript
}

export type LinePurpose = 'hook' | 'story' | 'outro'

export type LineAudio = {
  mediaKey: string
  durationSec: number
  words: Word[]
  source: 'ai' | 'recorded'
  voiceId?: string
  /** hash of the text this audio was made for; mismatch = stale */
  textHash: string
}

export type ScriptLine = {
  id: string
  text: string
  purpose: LinePurpose
  visualIntent: string
  onScreenText?: string
  audio?: LineAudio
}

export type Script = { title: string; lines: ScriptLine[] }

export type VoiceMode = 'ai' | 'recorded' | 'none'
export type VoiceSettings = { mode: VoiceMode; voiceId: string; volumeDb: number }

export type Transition = 'cut' | 'crossfade' | 'dip' | 'whip'
export type ClipAudioMode = 'mute' | 'duck' | 'full'

export type Shot = {
  id: string
  clipId: string
  /** seconds within the source clip */
  in: number
  out: number
  crop: { focusX: number; focusY: number; zoom: number }
  clipAudio: ClipAudioMode
  transitionIn: Transition
}

export type Scene = { id: string; lineId?: string; shots: Shot[] }

export type MusicSettings = { trackId: string; gainDb: number; duckUnderVoice: boolean }

export type EditPlan = {
  version: number
  createdAt: number
  createdBy: 'ai' | 'user' | 'fallback'
  note?: string
  aspect: Aspect
  fps: 30
  scenes: Scene[]
  title: { text: string; showUntilSec: number | 'always' }
  music?: MusicSettings
}

export type StyleId = 'classic' | 'bold' | 'minimal' | 'neon'

export type ProjectStep = 'clips' | 'script' | 'voice' | 'generate' | 'edit'

export type Project = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  step: ProjectStep
  settings: ProjectSettings
  prompt: string
  clipIds: string[]
  script?: Script
  voice: VoiceSettings
  /** undo history, newest last */
  edits: EditPlan[]
  /** index into edits of the version being shown */
  currentEdit: number
  musicTrackId: string | null
  musicGainDb: number
  styleId: StyleId
}

export const DEFAULT_SETTINGS: ProjectSettings = { aspect: '9:16', targetSec: 'auto', vibe: 'auto', language: 'en' }
