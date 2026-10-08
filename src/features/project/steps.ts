import type { ProjectStep } from '@/domain/types'

export const STEPS: { id: ProjectStep; label: string }[] = [
  { id: 'clips', label: 'Clips' },
  { id: 'script', label: 'Script' },
  { id: 'voice', label: 'Voice' },
  { id: 'generate', label: 'Make' },
  { id: 'edit', label: 'Edit' },
]

export const stepIndex = (s: ProjectStep) => STEPS.findIndex((x) => x.id === s)
export const stepPath = (projectId: string, s: ProjectStep) => `/p/${projectId}/${s}`
