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
  /** edit template; 'auto' lets the app pick from the vibe */
  template?: TemplateId | 'auto'
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
  /** how it was read, so a change of delivery re-voices the line */
  delivery?: Delivery
  seed?: number
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
  /** AI voice skips this line; it shows as a caption only */
  muted?: boolean
  /** how the AI voice reads it (default natural) */
  delivery?: Delivery
  /** changes on "Read again" so the reading comes out different */
  seed?: number
}

/** How the AI voice reads a line. */
export type Delivery = 'natural' | 'calm' | 'energetic' | 'slow'

export type Script = { title: string; lines: ScriptLine[] }

export type VoiceMode = 'ai' | 'recorded' | 'none'

/** One recording on the voice track ("Record my own"). Times in seconds. */
export type VoiceTake = {
  id: string
  /** the recording, in the on-device media store */
  mediaKey: string
  /** where it starts on the vlog's timeline */
  start: number
  /** the part of the recording that's used */
  in: number
  out: number
  /** full length of the recording */
  durationSec: number
  /** 0..2, default 1 */
  volume: number
  createdAt: number
  /** loudness envelope for drawing the waveform (0..1, ~40 values per second) */
  peaks: number[]
  /** what was said, word-timed in recording time (for captions) */
  words?: Word[]
  transcript?: 'pending' | 'done' | 'failed'
}

/**
 * The user's own voiceover, recorded over the made vlog. Takes sit at fixed
 * timeline times and never move with edits.
 */
export type VoiceTrack = {
  takes: VoiceTake[]
  /** "script": read the script (lines stay as written). "own": say anything; the script becomes what was said. */
  follow?: 'script' | 'own'
}
export type VoiceSettings = { mode: VoiceMode; voiceId: string; volumeDb: number }

export const TRANSITIONS = ['cut', 'crossfade', 'dip', 'whip', 'slide', 'zoom', 'flash', 'blur'] as const
export type Transition = (typeof TRANSITIONS)[number]
export type ClipAudioMode = 'mute' | 'duck' | 'full'

/** Camera-style movement applied to a shot. */
export const MOTIONS = ['none', 'zoomIn', 'zoomOut', 'panLeft', 'panRight', 'punch', 'shake'] as const
export type Motion = (typeof MOTIONS)[number]

/** Speed curves: the shot's footage plays faster/slower along the way. */
export const RAMPS = ['none', 'montage', 'hero', 'bullet'] as const
export type Ramp = (typeof RAMPS)[number]

/** How footage that doesn't match the frame's shape is shown. */
export type Fit = 'fill' | 'blur'

export type Shot = {
  id: string
  clipId: string
  /** seconds within the source clip */
  in: number
  out: number
  crop: { focusX: number; focusY: number; zoom: number }
  clipAudio: ClipAudioMode
  transitionIn: Transition
  /** playback speed, 0.25-4 (default 1); the shot lasts (out - in) / speed */
  speed?: number
  /** speed curve on top of `speed` (clip sound is muted while ramping) */
  ramp?: Ramp
  /** freeze frame: show the frame at `in` for this many seconds */
  hold?: number
  /** clip sound level, 0-2 (default 1) */
  volume?: number
  motion?: Motion
  /** overrides the plan's fit for this shot */
  fit?: Fit
}

export type Scene = { id: string; lineId?: string; shots: Shot[] }

export type MusicSettings = { trackId: string; gainDb: number; duckUnderVoice: boolean }

export const FILTERS = ['none', 'warm', 'vivid', 'film', 'teal', 'fade', 'mono', 'cool'] as const
export type FilterId = (typeof FILTERS)[number]

/** Color look for the whole vlog. Adjustments are -1..1 (0 = unchanged). */
export type Look = {
  filter: FilterId
  /** 0..1 */
  intensity: number
  brightness: number
  contrast: number
  saturation: number
  warmth: number
  /** 0..1 */
  vignette: number
  /** 0..1 */
  grain: number
  fit: Fit
  /** cinematic black bars at the top and bottom */
  letterbox?: boolean
}

export const DEFAULT_LOOK: Look = { filter: 'none', intensity: 1, brightness: 0, contrast: 0, saturation: 0, warmth: 0, vignette: 0, grain: 0, fit: 'fill' }

export type TemplateId = 'daily' | 'trend' | 'cinematic' | 'travel' | 'aesthetic' | 'clean'

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
  look?: Look
  /** fade from / to black at the start and end */
  fades?: { in: boolean; out: boolean }
  templateId?: TemplateId
  /** scenes whose footage the user picked by hand: AI re-plans keep them */
  userScenes?: string[]
  /** the script as it was when this version was saved, so undo / redo bring the words back too */
  script?: Script
}

export type StyleId = 'ember' | 'classic' | 'bold' | 'minimal' | 'neon' | 'soft'

export type ProjectStep = 'clips' | 'script' | 'voice' | 'generate' | 'record' | 'edit'

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
  /** "Record my own" voiceover takes */
  voiceTrack?: VoiceTrack
  /** undo history, newest last */
  edits: EditPlan[]
  /** index into edits of the version being shown */
  currentEdit: number
  musicTrackId: string | null
  musicGainDb: number
  styleId: StyleId
}

export const DEFAULT_SETTINGS: ProjectSettings = { aspect: '9:16', targetSec: 'auto', vibe: 'auto', language: 'en' }
