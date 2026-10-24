import { liveAi } from './live'
import type { AiService } from './service'

/** The AI service: the Supabase Edge Function `ai` (Gemini or Claude + ElevenLabs). */
export const ai: AiService = liveAi
export { AiError } from './service'
