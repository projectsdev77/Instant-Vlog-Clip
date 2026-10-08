import { VOICES } from '@shared/contracts.ts'
import { liveAi } from './live'
import { mockAi } from './mock'
import type { AiService } from './service'

export const aiMode: 'mock' | 'live' = import.meta.env.VITE_AI_MODE === 'live' ? 'live' : 'mock'
export const ai: AiService = aiMode === 'live' ? liveAi : mockAi
export const voices = VOICES
export { AiError } from './service'
