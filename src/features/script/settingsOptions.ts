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

export function templateHint(id: TemplateId | 'auto'): string {
  if (id === 'auto') return 'Auto: the Day in my life style, which suits most vlogs.'
  const t = TEMPLATES.find((x) => x.id === id)
  return t ? `${t.name}: ${t.description}.` : ''
}
