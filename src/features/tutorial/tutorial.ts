import { create } from 'zustand'

/**
 * First-visit tutorial: an intro on the home page, then tips that point at
 * the key control on each step. Progress lives in this browser only.
 */
type TutorialState = {
  /** the intro was shown (or skipped) */
  introSeen: boolean
  /** step tips are showing */
  active: boolean
  /** tips already seen */
  done: string[]
  introOpen: boolean
  openIntro: () => void
  closeIntro: () => void
  /** starts the step-by-step tips */
  start: () => void
  skip: () => void
  markDone: (id: string) => void
  finish: () => void
}

const KEY = 'ivc-tutorial-v1'

type Saved = Pick<TutorialState, 'introSeen' | 'active' | 'done'>

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as Partial<Saved>
      return { introSeen: !!s.introSeen, active: !!s.active, done: Array.isArray(s.done) ? s.done : [] }
    }
  } catch {
    /* private mode or blocked storage: start fresh */
  }
  return { introSeen: false, active: false, done: [] }
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ introSeen: s.introSeen, active: s.active, done: s.done }))
  } catch {
    /* ignore */
  }
}

export const useTutorial = create<TutorialState>((set, get) => {
  const update = (patch: Partial<Saved> & { introOpen?: boolean }) => {
    set(patch)
    save(get())
  }
  return {
    ...load(),
    introOpen: false,
    openIntro: () => set({ introOpen: true }),
    closeIntro: () => update({ introOpen: false, introSeen: true }),
    start: () => update({ introOpen: false, introSeen: true, active: true, done: [] }),
    skip: () => update({ introOpen: false, introSeen: true, active: false }),
    markDone: (id) => {
      if (!get().done.includes(id)) update({ done: [...get().done, id] })
    },
    finish: () => update({ active: false }),
  }
})
