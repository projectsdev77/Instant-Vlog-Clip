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
  /** total length to aim for when there are no lines */
  targetSec: number
  catalog: CatalogEntry[]
  /** plain-language change request from the user ("make it punchier") */
  feedback?: string
  /** the plan the feedback refers to */
  currentPlan?: PlanResponse
  /** validation errors from a previous attempt */
  previousIssues?: string[]
}

export type PlanShotWire = {
  clipId: string
  in: number
  out: number
  focusX: number
  focusY: number
  clipAudio: 'mute' | 'duck' | 'full'
  transitionIn: 'cut' | 'crossfade' | 'dip' | 'whip'
}

export type PlanResponse = {
  note: string
  scenes: { lineId: string; shots: PlanShotWire[] }[]
}

export type SynthesizeRequest = { text: string; voiceId: string; language: string }
export type WordWire = { word: string; start: number; end: number }
export type SynthesizeResponse = { audioBase64: string; mime: string; words: WordWire[] }

export type TranscribeRequest = { audioBase64: string; mime: string; language: string }
export type TranscribeResponse = { text: string; words: WordWire[] }

export type AiAction =
  | { action: 'analyze-clip'; payload: AnalyzeClipRequest }
  | { action: 'write-script'; payload: ScriptRequest }
  | { action: 'plan-edit'; payload: PlanRequest }
  | { action: 'synthesize'; payload: SynthesizeRequest }
  | { action: 'transcribe'; payload: TranscribeRequest }

export type AiErrorBody = { error: string; code: 'quota' | 'auth' | 'bad_request' | 'upstream' | 'refusal' }

export type VoiceOption = { id: string; name: string; description: string; gender: 'female' | 'male'; accent: 'American' | 'British' }

/**
 * Stock English voices. IDs are ElevenLabs premade voices; check them against
 * the ElevenLabs voice library before launch and swap freely.
 */
export const VOICES: VoiceOption[] = [
  { id: 'ava', name: 'Ava', description: 'Warm and upbeat', gender: 'female', accent: 'American' },
  { id: 'leo', name: 'Leo', description: 'Calm, low and easy', gender: 'male', accent: 'American' },
  { id: 'mia', name: 'Mia', description: 'Bright and friendly', gender: 'female', accent: 'American' },
  { id: 'sam', name: 'Sam', description: 'Relaxed, like a friend talking', gender: 'male', accent: 'American' },
  { id: 'grace', name: 'Grace', description: 'Soft and clear', gender: 'female', accent: 'British' },
  { id: 'oliver', name: 'Oliver', description: 'Dry, a little witty', gender: 'male', accent: 'British' },
]

/** App voice id → ElevenLabs voice id. */
export const ELEVENLABS_VOICE_IDS: Record<string, string> = {
  ava: '21m00Tcm4TlvDq8ikWAM',
  leo: 'pNInz6obpgDQGcFmaJgB',
  mia: 'MF3mGyEYCl7XYWbV9V5O',
  sam: 'TxGEqnHWrfWFTfGW9XjX',
  grace: 'XB0fDUnXU5powFXDhCwa',
  oliver: 'onwK4e9ZLuTAKqWW03F9',
}
