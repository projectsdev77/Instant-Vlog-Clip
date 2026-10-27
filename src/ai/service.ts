import type {
  AnalyzeClipRequest,
  EditRequest,
  EditResponse,
  VoiceOption,
  PlanRequest,
  ScriptRequest,
  ScriptResponse,
  TranscribeResponse,
} from '@shared/contracts.ts'
import type { ClipAnalysis, Delivery, Word } from '@/domain/types'

export type SynthesizedLine = { audio: Blob; words: Word[] }

/** Everything the app asks of AI. Implemented by the live provider (the Supabase Edge Function). */
export interface AiService {
  analyzeClip(req: AnalyzeClipRequest): Promise<ClipAnalysis>
  writeScript(req: ScriptRequest): Promise<ScriptResponse>
  /** Copy-edits the user's own lines; always returns one line per input line. */
  polishLines(lines: string[], language: string): Promise<string[]>
  /** Raw plan; always run it through repairPlan */
  planEdit(req: PlanRequest): Promise<unknown>
  /** Ask AI on the Edit page: a reply and the exact changes to make (check each one before applying it) */
  editRequest(req: EditRequest): Promise<EditResponse>
  synthesize(text: string, voiceId: string, language: string, opts?: { delivery?: Delivery; seed?: number }): Promise<SynthesizedLine>
  transcribe(audio: Blob, language: string, knownText?: string): Promise<TranscribeResponse>
  /** The voices on the app's ElevenLabs account (empty means: use the built-in ones). */
  listVoices(): Promise<VoiceOption[]>
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly code: 'quota' | 'auth' | 'bad_request' | 'upstream' | 'refusal' | 'network',
  ) {
    super(message)
  }
}
