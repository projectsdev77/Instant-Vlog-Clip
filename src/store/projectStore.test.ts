import { describe, expect, it } from 'vitest'
import { makeClip } from '@/test/fixtures'
import { db } from '@/lib/db'
import { createProject, useProject } from './projectStore'

describe('project store', () => {
  it('persists projects and clips across loads', async () => {
    const p = await createProject()
    await useProject.getState().load(p.id)
    await useProject.getState().updateProject({ title: 'Lisbon' })
    await useProject.getState().addClip(makeClip('c1', 5, { projectId: p.id }))
    useProject.setState({ project: null, clips: [] })
    await useProject.getState().load(p.id)
    const s = useProject.getState()
    expect(s.project?.title).toBe('Lisbon')
    expect(s.project?.clipIds).toEqual(['c1'])
    expect(s.clips.map((c) => c.id)).toEqual(['c1'])
    expect(await db.projects.count()).toBeGreaterThan(0)
  })

  it('keeps edit history and truncates redo branch', async () => {
    const p = await createProject()
    useProject.setState({ project: null, clips: [] })
    await useProject.getState().load(p.id)
    const plan = { version: 0, createdAt: 0, createdBy: 'ai' as const, aspect: '9:16' as const, fps: 30 as const, scenes: [], title: { text: '', showUntilSec: 3 } }
    await useProject.getState().pushEdit(plan)
    await useProject.getState().pushEdit(plan)
    await useProject.getState().updateProject({ currentEdit: 0 })
    await useProject.getState().pushEdit(plan)
    const s = useProject.getState().project!
    expect(s.edits.map((e) => e.version)).toEqual([1, 2])
    expect(s.currentEdit).toBe(1)
  })
})
