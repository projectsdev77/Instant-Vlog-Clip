import type { Aspect, TargetLength, Vibe } from '@/domain/types'

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

export const VIBES: { value: Vibe; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'chill', label: 'Chill' },
  { value: 'upbeat', label: 'Upbeat' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'funny', label: 'Funny' },
  { value: 'aesthetic', label: 'Aesthetic' },
]
