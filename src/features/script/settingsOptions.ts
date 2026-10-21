import { TEMPLATES } from '@/domain/templates'
import type { Aspect, TargetLength, TemplateId } from '@/domain/types'

export const ASPECTS: { value: Aspect; label: string }[] = [
  { value: '9:16', label: 'Vertical 9:16' },
  { value: '1:1', label: 'Square 1:1' },
  { value: '16:9', label: 'Wide 16:9' },
]

export const LENGTHS: { value: TargetLength; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '60s' },
]


export const TEMPLATE_OPTIONS: { value: TemplateId | 'auto'; label: string }[] = [{ value: 'auto', label: 'Auto' }, ...TEMPLATES.map((t) => ({ value: t.id, label: t.name }))]

const TEMPLATE_HINTS: Record<TemplateId | 'auto', string> = {
  auto: 'Picks the Day in my life style, which suits most vlogs.',
  daily: 'Soft cuts, warm colour, captions at the bottom.',
  trend: 'Quick cuts on the beat, bold punchy captions.',
  cinematic: 'Slow fades, letterbox bars, film colour.',
  travel: 'Upbeat cuts with place-name titles.',
  aesthetic: 'Muted tones, minimal lowercase captions.',
  clean: 'Straight cuts, no effects, plain captions.',
}

export const templateHint = (id: TemplateId | 'auto') => TEMPLATE_HINTS[id]
