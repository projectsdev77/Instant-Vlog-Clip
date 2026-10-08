import { VOICES } from '@shared/contracts.ts'
import { liveAi } from './live'
import { mockAi } from './mock'
import type { AiService } from './service'

import { aiMode } from './mode'

export { aiMode }
export const ai: AiService = aiMode === 'live' ? liveAi : mockAi
export const voices = VOICES
export { AiError } from './service'
