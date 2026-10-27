/**
 * Wire contracts between the app and the `ai` Edge Function. Shared by both
 * sides (the app imports it via the @shared alias), so keep it dependency-free.
 */

export type ShotTypeWire = 'talking_head' | 'wide' | 'closeup' | 'pov' | 'pan' | 'other'

export type AnalyzeClipRequest = {
  clipId: string
  fileName: string
  durationSec: number
  /** JPEG contact sheet, base64 without data: prefix */
  contactSheetBase64: string
  /** timestamp (s) of each frame in the sheet, left-to-right, top-to-bottom */
  frameTimes: number[]
  /** what the person says on camera, if anything */
  transcript?: string
  speechRatio: number
}

export type AnalyzeClipResponse = {
  description: string
  tags: string[]
  shotType: ShotTypeWire
  quality: { shaky: boolean; blurry: boolean; dark: boolean; accidental: boolean }
  moments: { start: number; end: number; score: number; why: string; focusX: number; focusY: number }[]
}

export type CatalogEntry = {
  clipId: string
  durationSec: number
  recordedAt?: string
  description: string
  tags: string[]
  shotType: ShotTypeWire
  mustInclude: boolean
  unusable: boolean
  moments: { start: number; end: number; score: number; why: string }[]
  transcript?: string
}

export type ScriptRequest = {
  mode: 'write' | 'polish'
  language: string
  title: string
  prompt: string
  /** the user's own lines (polish mode, or hints for write mode) */
  lines: string[]
  targetSec: number | 'auto'
  vibe: string
  catalog: CatalogEntry[]
  /** edit template id (e.g. 'travel'), for style hints */
  template?: string
}

export type ScriptResponse = {
  title: string
  lines: { text: string; purpose: 'hook' | 'story' | 'outro'; visualIntent: string; onScreenText: string }[]
}

export type PlanLine = { lineId: string; text: string; visualIntent: string; sceneSec: number }

export type PlanRequest = {
  aspect: '9:16' | '1:1' | '16:9'
  vibe: string
  narrated: boolean
  /** narration lines in order; empty for a music-only vlog */
  lines: PlanLine[]
  /** total length to aim for, seconds (narrated scenes plus footage-only scenes) */
  targetSec: number
  /** true: show every usable clip even past targetSec; false: keep near targetSec (mustInclude clips still appear) */
  useEveryClip?: boolean
  catalog: CatalogEntry[]
  /** plain-language change request from the user ("make it punchier") */
  feedback?: string
  /** the plan the feedback refers to */
  currentPlan?: PlanResponse
  /** validation errors from a previous attempt */
  previousIssues?: string[]
  /** edit template (transitions, effects, pacing) */
  template?: PlanTemplate
  /**
   * The user recorded their own voice over this exact scene timing: output
   * exactly these scenes, in this order, each adding up to its sceneSec.
   * lineId "" = footage-only scene.
   */
  layout?: { lineId: string; sceneSec: number }[]
}

export type TransitionWire = 'cut' | 'crossfade' | 'dip' | 'whip' | 'slide' | 'zoom' | 'flash' | 'blur'
export type MotionWire = 'none' | 'zoomIn' | 'zoomOut' | 'panLeft' | 'panRight' | 'punch' | 'shake'
export type RampWire = 'none' | 'montage' | 'hero' | 'bullet'

export type PlanShotWire = {
  clipId: string
  in: number
  out: number
  focusX: number
  focusY: number
  clipAudio: 'mute' | 'duck' | 'full'
  transitionIn: TransitionWire
  /** camera move; "none" for a still frame */
  motion: MotionWire
  /** playback speed, 1 = normal; the shot lasts (out - in) / speed */
  speed: number
  ramp: RampWire
}

/** The edit template's style rules, for the AI editor. */
export type PlanTemplate = {
  name: string
  /** how this template cuts, in plain words */
  guide: string
  transitions: TransitionWire[]
  motions: MotionWire[]
  /** speeds the editor may use besides 1 */
  speeds: number[]
  ramps: RampWire[]
  /** typical footage-only shot length, seconds */
  shotSec: number
}

export type PlanResponse = {
  note: string
  scenes: { lineId: string; shots: PlanShotWire[] }[]
}

/**
 * "Ask AI" on the Edit page: the user's request plus the vlog as it is now.
 * The answer is a short reply and a list of exact changes the app applies
 * with its own edit tools, so everything not asked for stays as it is.
 */
export type EditRequest = {
  request: string
  /** the last few requests and replies, oldest first, so "more" or an answer to a question makes sense */
  history: { request: string; reply: string }[]
  language: string
  voiceMode: 'ai' | 'recorded' | 'none'
  vlog: EditStateWire
  catalog: CatalogEntry[]
  options: {
    voices: { id: string; name: string; description: string }[]
    music: { id: string; name: string; description: string }[]
    templates: { id: string; name: string }[]
    captions: { id: string; name: string; description: string }[]
    filters: string[]
  }
}

export type EditShotWire = {
  clipId: string
  in: number
  out: number
  seconds: number
  speed: number
  ramp: RampWire
  motion: MotionWire
  transitionIn: TransitionWire
  clipAudio: 'mute' | 'duck' | 'full'
  volume: number
  fit: 'look' | 'fill' | 'blur'
  frozen: boolean
}

export type EditStateWire = {
  title: string
  titleShow: 'off' | 'start' | 'always'
  captions: string
  music: string
  musicLevelDb: number
  voice: string
  template: string
  lengthSec: number
  targetSec: number | 'auto'
  look: { filter: string; brightness: number; contrast: number; saturation: number; warmth: number; vignette: number; grain: number; letterbox: boolean; fades: 'none' | 'in' | 'out' | 'both' }
  /** handEdited: what the user changed in the scene by hand (footage, effects, sound, words) */
  scenes: { ref: string; seconds: number; line: string; lineMuted: boolean; delivery: string; handEdited: string[]; shots: EditShotWire[] }[]
}

export const EDIT_OPS = [
  'move-scene',
  'delete-scene',
  'duplicate-scene',
  'add-scene',
  'swap-footage',
  'speed',
  'camera',
  'transition',
  'clip-sound',
  'clip-volume',
  'frame',
  'freeze-end',
  'rewrite-line',
  'add-line',
  'remove-line',
  'reread-line',
  'mute-line',
  'voice',
  'filter',
  'adjust',
  'letterbox',
  'fades',
  'template',
  'music',
  'music-level',
  'captions',
  'title',
  'title-show',
  'length',
] as const
export type EditOpName = (typeof EDIT_OPS)[number]

/** One change. Fields an operation doesn't use are "" or 0. */
export type EditOpWire = {
  op: EditOpName
  /** scene ref ("s3"); "" for changes to the whole vlog */
  scene: string
  /** 1-based shot in the scene; 0 = every shot */
  shot: number
  /** move-scene: the new 1-based position */
  to: number
  value: string
  amount: number
}

export type EditResponse = { reply: string; ops: EditOpWire[] }

/** How a line is read: `natural` is the voice's own default. */
export type Delivery = 'natural' | 'calm' | 'energetic' | 'slow'
/** `seed` varies the reading, so "Read again" sounds different. */
export type SynthesizeRequest = { text: string; voiceId: string; language: string; delivery?: Delivery; seed?: number }
export type WordWire = { word: string; start: number; end: number }
export type SynthesizeResponse = { audioBase64: string; mime: string; words: WordWire[] }

export type TranscribeRequest = { audioBase64: string; mime: string; language: string }
export type TranscribeResponse = { text: string; words: WordWire[] }

/**
 * Version of the AI function this app expects. The function sends it back in
 * the x-ai-version header; the app warns when the deployed function is older.
 * Bump it whenever the function's behaviour changes.
 */
export const AI_FUNCTION_VERSION = '2026-10-27.13'

export type PolishRequest = { lines: string[]; language: string }
export type PolishResponse = { lines: string[] }

export type AiAction =
  | { action: 'analyze-clip'; payload: AnalyzeClipRequest }
  | { action: 'write-script'; payload: ScriptRequest }
  | { action: 'polish-lines'; payload: PolishRequest }
  | { action: 'plan-edit'; payload: PlanRequest }
  | { action: 'edit-request'; payload: EditRequest }
  | { action: 'synthesize'; payload: SynthesizeRequest }
  | { action: 'transcribe'; payload: TranscribeRequest }
  | { action: 'list-voices'; payload?: undefined }

export type AiErrorBody = { error: string; code: 'quota' | 'auth' | 'bad_request' | 'upstream' | 'refusal' }

export type VoiceOption = { id: string; name: string; description: string; gender: 'female' | 'male' | 'neutral'; accent: string }

/** The voices to offer: the ones added to the app's ElevenLabs account, or the built-in list if none are. */
export type VoicesResponse = { voices: VoiceOption[]; source: 'account' | 'builtin' }

/**
 * The built-in voices, used until voices are added to the app's ElevenLabs
 * account (the app then lists those instead; see docs/SETUP_GUIDE.md). These
 * are ElevenLabs "default" voices, which stop working on December 31, 2026
 * and aren't available to accounts created after March 2026.
 */
export const VOICES: VoiceOption[] = [
  { id: 'mia', name: 'Mia', description: 'Playful and bubbly', gender: 'female', accent: 'American' },
  { id: 'sam', name: 'Sam', description: 'Laid-back, like a friend talking', gender: 'male', accent: 'American' },
  { id: 'zoe', name: 'Zoe', description: 'Upbeat and a little quirky', gender: 'female', accent: 'American' },
  { id: 'will', name: 'Will', description: 'Chill and friendly', gender: 'male', accent: 'American' },
  { id: 'charlie', name: 'Charlie', description: 'Easygoing Aussie', gender: 'male', accent: 'Australian' },
  { id: 'ava', name: 'Ava', description: 'Warm and upbeat', gender: 'female', accent: 'American' },
  { id: 'liam', name: 'Liam', description: 'Young and energetic', gender: 'male', accent: 'American' },
  { id: 'river', name: 'River', description: 'Relaxed and easy', gender: 'neutral', accent: 'American' },
]

/** App voice id → ElevenLabs voice id. Retired voices stay so older vlogs still play. */
export const ELEVENLABS_VOICE_IDS: Record<string, string> = {
  mia: 'cgSgspJ2msm6clMCkdW9', // Jessica
  sam: 'iP95p4xoKVk53GoZ742B', // Chris
  zoe: 'FGY2WhTYpPnrIDTdsKH5', // Laura
  will: 'bIHbv24MWmeRgasZH58o', // Will
  charlie: 'IKne3meq5aSn9XLyUdCD', // Charlie
  ava: 'EXAVITQu4vr4xnSDxMaL', // Sarah
  liam: 'TX3LPaxmHKxFdv7VOQHJ', // Liam
  river: 'SAz9YHcvj6GT2YYXdXww', // River
  // retired (too formal for vlogs)
  leo: 'nPczCjzI2devNBz1zQrb', // Brian
  grace: 'Xb7hH8MSUJpSbSDYk0k2', // Alice
  oliver: 'JBFqnCBsd6RMkjVDRZzb', // George
}
