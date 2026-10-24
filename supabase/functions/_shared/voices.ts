import type { VoiceOption } from './contracts.ts'

/** A voice as ElevenLabs' GET /v1/voices lists it (only the fields used). */
export type AccountVoice = { voice_id: string; name: string; category?: string; description?: string | null; labels?: Record<string, string | undefined> }

const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()

/** "Jade - Upbeat and Natural" → Jade, "Upbeat and Natural"; otherwise the voice's descriptive label. */
export function toVoiceOption(v: AccountVoice): VoiceOption {
  const [first, ...rest] = v.name.split(/\s+[-–—|]\s+/)
  const labels = v.labels ?? {}
  const description = rest.join(' – ') || (labels.descriptive ? titleCase(labels.descriptive) : '') || (labels.use_case ? titleCase(labels.use_case) : '')
  const gender = labels.gender === 'female' || labels.gender === 'male' ? labels.gender : 'neutral'
  return { id: v.voice_id, name: first.trim() || v.name, description, gender, accent: labels.accent ? titleCase(labels.accent) : '' }
}
