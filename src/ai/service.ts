import type {
  AnalyzeClipRequest,
  PlanRequest,
  ScriptRequest,
  ScriptResponse,
  TranscribeResponse,
} from '@shared/contracts.ts'
import type { ClipAnalysis, Word } from '@/domain/types'

export type SynthesizedLine = { audio: Blob; words: Word[] }

/** Everything the app asks of AI. Implemented by the mock (demo) and live (Edge Function) providers. */
export interface AiService {
  analyzeClip(req: AnalyzeClipRequest): Promise<ClipAnalysis>
  writeScript(req: ScriptRequest): Promise<ScriptResponse>
  /** Raw plan; always run it through repairPlan */
  planEdit(req: PlanRequest): Promise<unknown>
  synthesize(text: string, voiceId: string, language: string): Promise<SynthesizedLine>
  transcribe(audio: Blob, language: string, knownText?: string): Promise<TranscribeResponse>
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly code: 'quota' | 'auth' | 'bad_request' | 'upstream' | 'refusal' | 'network',
  ) {
    super(message)
  }
}
