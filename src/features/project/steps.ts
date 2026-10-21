import type { ProjectStep, VoiceMode } from '@/domain/types'

/** Every step in order. "Record" only exists when the user records their own voice. */
export const STEPS: { id: ProjectStep; label: string }[] = [
  { id: 'clips', label: 'Clips' },
  { id: 'script', label: 'Script' },
  { id: 'voice', label: 'Voice' },
  { id: 'generate', label: 'Make' },
  { id: 'record', label: 'Record' },
  { id: 'edit', label: 'Edit' },
]

/** The steps this project goes through. */
export const stepsFor = (mode: VoiceMode | undefined) => STEPS.filter((s) => s.id !== 'record' || mode === 'recorded')

export const stepIndex = (s: ProjectStep) => STEPS.findIndex((x) => x.id === s)
export const stepPath = (projectId: string, s: ProjectStep) => `/p/${projectId}/${s}`
