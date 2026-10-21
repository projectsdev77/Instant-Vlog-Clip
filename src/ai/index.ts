import { VOICES } from '@shared/contracts.ts'
import { liveAi } from './live'
import type { AiService } from './service'

/** The AI service: the Supabase Edge Function `ai` (Gemini or Claude + ElevenLabs). */
export const ai: AiService = liveAi
export const voices = VOICES
export { AiError } from './service'
