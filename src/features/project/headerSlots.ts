import type { ReactNode } from 'react'
import { create } from 'zustand'

/**
 * Lets a step put its own controls into the shared header: `start` replaces
 * the logo on phones (a Back button), `end` sits on the right (Edit: undo,
 * versions, export).
 */
export const useHeaderSlots = create<{ start: ReactNode; end: ReactNode }>(() => ({ start: null, end: null }))
