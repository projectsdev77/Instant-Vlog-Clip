import { create } from 'zustand'
import { uid } from '@/domain/ids'
import type { Clip, EditPlan, Project } from '@/domain/types'
import { DEFAULT_SETTINGS } from '@/domain/types'
import { db } from '@/lib/db'
import { deleteMedia } from '@/lib/mediaStore'

export const DEFAULT_VOICE_ID = 'ava'

export function newProject(): Project {
  const now = Date.now()
  return {
    id: uid('p_'),
    title: '',
    createdAt: now,
    updatedAt: now,
    step: 'clips',
    settings: { ...DEFAULT_SETTINGS },
    prompt: '',
    clipIds: [],
    voice: { mode: 'ai', voiceId: DEFAULT_VOICE_ID, volumeDb: 0 },
    edits: [],
    currentEdit: -1,
    musicTrackId: 'auto',
    musicGainDb: -14,
    styleId: 'classic',
  }
}

type State = {
  project: Project | null
  clips: Clip[]
  loading: boolean
  load: (id: string) => Promise<void>
  updateProject: (patch: Partial<Project> | ((p: Project) => Partial<Project>)) => Promise<void>
  addClip: (clip: Clip) => Promise<void>
  updateClip: (id: string, patch: Partial<Clip>) => Promise<void>
  removeClip: (id: string) => Promise<void>
  pushEdit: (plan: EditPlan) => Promise<void>
  replaceCurrentEdit: (plan: EditPlan) => Promise<void>
}

/** The project currently open in the editor. Every change is saved to IndexedDB. */
export const useProject = create<State>((set, get) => ({
  project: null,
  clips: [],
  loading: false,

  load: async (id) => {
    if (get().project?.id === id) return
    set({ loading: true })
    const project = (await db.projects.get(id)) ?? null
    const clips = project ? await db.clips.where('projectId').equals(id).toArray() : []
    const order = new Map(project?.clipIds.map((c, i) => [c, i]))
    clips.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    // Anything mid-import when the tab closed needs redoing.
    for (const c of clips) if (c.status === 'importing' || c.status === 'analyzing') c.status = c.durationSec ? 'ready' : 'error'
    set({ project, clips, loading: false })
  },

  updateProject: async (patch) => {
    const cur = get().project
    if (!cur) return
    const next = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch), updatedAt: Date.now() }
    set({ project: next })
    await db.projects.put(next)
  },

  addClip: async (clip) => {
    set((s) => ({ clips: [...s.clips, clip] }))
    await db.clips.put(clip)
    await get().updateProject((p) => ({ clipIds: [...p.clipIds, clip.id] }))
  },

  updateClip: async (id, patch) => {
    let updated: Clip | undefined
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== id) return c
        updated = { ...c, ...patch }
        return updated
      }),
    }))
    if (updated) await db.clips.put(updated)
  },

  removeClip: async (id) => {
    const clip = get().clips.find((c) => c.id === id)
    set((s) => ({ clips: s.clips.filter((c) => c.id !== id) }))
    await db.clips.delete(id)
    if (clip) await deleteMedia(clip.mediaKey)
    await get().updateProject((p) => ({ clipIds: p.clipIds.filter((c) => c !== id) }))
  },

  pushEdit: async (plan) => {
    await get().updateProject((p) => {
      const kept = p.edits.slice(0, p.currentEdit + 1)
      const version = (kept[kept.length - 1]?.version ?? 0) + 1
      const edits = [...kept, { ...plan, version }].slice(-20)
      return { edits, currentEdit: edits.length - 1 }
    })
  },

  replaceCurrentEdit: async (plan) => {
    await get().updateProject((p) => {
      if (p.currentEdit < 0) return {}
      const edits = [...p.edits]
      edits[p.currentEdit] = plan
      return { edits }
    })
  },
}))

export function currentEdit(p: Project | null): EditPlan | undefined {
  return p && p.currentEdit >= 0 ? p.edits[p.currentEdit] : undefined
}

export async function createProject(): Promise<Project> {
  const p = newProject()
  await db.projects.put(p)
  return p
}

export async function deleteProject(id: string): Promise<void> {
  const clips = await db.clips.where('projectId').equals(id).toArray()
  const project = await db.projects.get(id)
  const audioKeys = project?.script?.lines.map((l) => l.audio?.mediaKey).filter((k): k is string => !!k) ?? []
  await Promise.all([...clips.map((c) => deleteMedia(c.mediaKey)), ...audioKeys.map(deleteMedia)])
  await db.clips.where('projectId').equals(id).delete()
  await db.projects.delete(id)
  if (useProject.getState().project?.id === id) useProject.setState({ project: null, clips: [] })
}
